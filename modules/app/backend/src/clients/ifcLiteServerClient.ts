import { createHash } from "crypto";
import { env } from "@spine/shared";

// Thin client for the self-hosted ifc-lite-server (see
// modules/modeling/docker-compose.yml) - lets us parse an IFC file's
// geometry server-side instead of shipping the raw IFC bytes to the
// browser.
//
// This is deliberately a pass-through relay, not a decoder: ifc-lite-server
// itself already documents a "server + client" split for exactly this
// scenario (production, large files) - the Rust server does the heavy IFC
// parsing, and the *client* decodes the resulting Parquet geometry, so each
// user's WASM memory usage lives and dies with their own browser tab
// instead of accumulating in one shared, long-lived backend process. We
// decode this in modules/app/frontend/src/components/feature/twin/
// ifcParquetDecoder.ts, not here - the batch payload below is passed
// through to the browser exactly as ifc-lite-server sent it (still
// base64-encoded Parquet bytes), untouched.

const BASE_URL = env.IFC_LITE_SERVER_URL.replace(/\/$/, "");

type IfcGeometryStreamEvent =
    | { type: "start"; totalEstimate: number }
    | { type: "progress"; processed: number; total: number }
    // `data` is base64-encoded Parquet geometry bytes, relayed as-is - see
    // the module comment for why this isn't decoded here.
    | { type: "batch"; batchNumber: number; data: string }
    // A cache hit's geometry arrives as one big blob rather than
    // server-chosen batches, so it's split into fixed-size fragments here
    // instead - see streamFromCache's doc comment for why. The frontend
    // concatenates `data` across chunkIndex 0..totalChunks-1 before decoding
    // the reassembled string as a single unit.
    | {
          type: "cachedGeometryChunk";
          chunkIndex: number;
          totalChunks: number;
          data: string;
      }
    | { type: "complete"; totalMeshes: number }
    | { type: "error"; message: string };

// The raw SSE event shapes ifc-lite-server's /parse/parquet-stream sends -
// trusted internal infra (our own self-hosted service), not user input, so
// this is a type assertion rather than runtime-validated.
type ServerStreamEvent =
    | { type: "start"; total_estimate: number; cache_key: string }
    | { type: "progress"; processed: number; total: number }
    | { type: "batch"; batch_number: number; data: string }
    | {
          type: "complete";
          stats?: { total_meshes?: number };
          metadata?: unknown;
      }
    | { type: "error"; message: string };

interface CachedGeometryMetadata {
    stats?: { total_meshes?: number };
}

// The full-geometry cache endpoint wraps the Parquet geometry section
// alongside a (here-unused) data-model section:
// `[geometry_len:u32][geometry_data][data_model_len:u32][data_model_data]`.
function unwrapGeometryPayload(payload: ArrayBuffer): Uint8Array {
    const view = new DataView(payload);
    const geometryLen = view.getUint32(0, true);
    return new Uint8Array(payload, 4, geometryLen);
}

/**
 * Tries to fetch a previously-parsed file's geometry straight from
 * ifc-lite-server's cache, keyed by content hash - no upload, no parsing.
 * Returns `null` on a cache miss (404).
 *
 * Deliberately doesn't call `/api/v1/cache/check/:hash` first: measured
 * against a real ifc-lite-server, a cache-check *hit* took ~1-1.4s (vs 3ms
 * for a miss) - some cost internal to that endpoint's hit path, not
 * something on our end. Since a hit here means we'd immediately turn around
 * and fetch `/cache/geometry/:hash` anyway, checking first only adds that
 * cost for no benefit - trying the geometry fetch directly and treating a
 * 404 as a miss gets the same result in one request instead of two.
 */
async function tryFetchCachedGeometry(
    hash: string,
    signal?: AbortSignal
): Promise<Response | null> {
    const response = await fetch(`${BASE_URL}/api/v1/cache/geometry/${hash}`, {
        signal
    });
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        throw new Error(
            `ifc-lite-server cache fetch failed with status ${response.status}`
        );
    }
    return response;
}

// Multiple of 3 so each chunk's base64 encoding has no padding of its own -
// concatenating N chunks' base64 text is then byte-for-byte identical to
// base64-encoding the whole thing at once.
const CACHED_GEOMETRY_CHUNK_SIZE = 6_000_000;

/**
 * A cache hit returns the whole model's geometry as one blob (unlike a live
 * parse, which ifc-lite-server itself sends as several smaller batches) -
 * for a large file this blob can be hundreds of MB. Base64-encoding it (and
 * then having tRPC JSON-serialize that string for the SSE event) as a
 * single unit means multiple full-size copies alive in the backend's heap
 * at once - measured against a real 254MB cache hit, this is what caused a
 * V8 heap-OOM crash. Splitting into fixed-size chunks before encoding keeps
 * peak memory bounded by chunk size instead of file size; the frontend
 * reassembles the base64 text before decoding it as one Parquet unit.
 */
async function* streamFromCache(
    response: Response
): AsyncGenerator<IfcGeometryStreamEvent> {
    const metadataHeader = response.headers.get("X-IFC-Metadata");
    const metadata: CachedGeometryMetadata = metadataHeader
        ? JSON.parse(metadataHeader)
        : {};
    const totalMeshes = metadata.stats?.total_meshes ?? 1;

    const payload = await response.arrayBuffer();
    const geometryBytes = unwrapGeometryPayload(payload);

    yield { type: "start", totalEstimate: totalMeshes };

    const totalChunks = Math.max(
        1,
        Math.ceil(geometryBytes.byteLength / CACHED_GEOMETRY_CHUNK_SIZE)
    );
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CACHED_GEOMETRY_CHUNK_SIZE;
        const end = Math.min(
            start + CACHED_GEOMETRY_CHUNK_SIZE,
            geometryBytes.byteLength
        );
        const chunk = geometryBytes.subarray(start, end);
        const data = Buffer.from(
            chunk.buffer,
            chunk.byteOffset,
            chunk.byteLength
        ).toString("base64");

        // No separate "progress" event here (chunkIndex/totalChunks above
        // already carry that) - a small event sent immediately after a
        // large one on the same connection measured at 500-1700ms per
        // chunk to relay (vs ~20ms for the chunk itself), the classic
        // signature of Nagle's algorithm interacting with delayed ACK.
        yield { type: "cachedGeometryChunk", chunkIndex, totalChunks, data };
    }

    yield { type: "complete", totalMeshes };
}

/**
 * Uploads a file to ifc-lite-server and relays its parsed-geometry SSE
 * stream to the caller as it arrives, translating field names but not
 * decoding the Parquet payload itself (see the module comment).
 *
 * If the underlying connection is interrupted partway through (e.g.
 * ifc-lite-server runs out of memory and is killed), the response stream
 * just ends with no further data - it's not an HTTP error. Without checking
 * for a terminal event, that looks identical to a normal end-of-stream, and
 * the caller would resolve as if parsing had quietly succeeded with zero
 * further output, leaving the frontend's loading state waiting forever for
 * a "complete" event that's never coming. So: throw explicitly if we never
 * saw one - unless the caller itself cancelled (`signal` aborted), which
 * isn't a failure.
 *
 * `signal` (from the subscription's AbortSignal - see digitalTwin.ts) is
 * threaded through so switching to a different file mid-stream actually
 * stops this one: without it, tRPC only calls `.return()` on our generator
 * at the *next* yield, which never comes because we're blocked on
 * `reader.read()` waiting for more of a response nobody wants anymore -
 * ifc-lite-server keeps sending, and this function keeps relaying, for a
 * subscription with no listener. Passing `signal` to `fetch` aborts that
 * in-flight request immediately instead of waiting for it to (never)
 * finish naturally.
 */
async function* streamFromUpload(
    buffer: Buffer,
    signal?: AbortSignal
): AsyncGenerator<IfcGeometryStreamEvent> {
    // A zero-copy view over the same bytes, typed against a plain
    // ArrayBuffer rather than Node's wider ArrayBufferLike (Buffer's own
    // type) so it satisfies BlobPart.
    const bufferView = new Uint8Array(
        buffer.buffer as ArrayBuffer,
        buffer.byteOffset,
        buffer.byteLength
    );

    const formData = new FormData();
    formData.append("file", new Blob([bufferView]), "model.ifc");

    const response = await fetch(`${BASE_URL}/api/v1/parse/parquet-stream`, {
        method: "POST",
        body: formData,
        signal
    });
    if (!response.ok || !response.body) {
        throw new Error(
            `ifc-lite-server parse request failed with status ${response.status}`
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let sawTerminalEvent = false;

    try {
        while (!signal?.aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            textBuffer += decoder.decode(value, { stream: true });
            const lines = textBuffer.split("\n");
            textBuffer = lines.pop() ?? "";

            for (const line of lines) {
                if (!line.startsWith("data:")) continue;
                const jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;

                let event: ServerStreamEvent;
                try {
                    event = JSON.parse(jsonStr);
                } catch (error) {
                    console.warn(
                        "[ifcLiteServerClient] Skipping malformed SSE event:",
                        jsonStr,
                        error
                    );
                    continue;
                }

                switch (event.type) {
                    case "start":
                        yield {
                            type: "start",
                            totalEstimate: event.total_estimate
                        };
                        break;
                    case "progress":
                        yield {
                            type: "progress",
                            processed: event.processed,
                            total: event.total
                        };
                        break;
                    case "batch":
                        yield {
                            type: "batch",
                            batchNumber: event.batch_number,
                            data: event.data
                        };
                        break;
                    case "complete":
                        sawTerminalEvent = true;
                        yield {
                            type: "complete",
                            totalMeshes: event.stats?.total_meshes ?? 0
                        };
                        break;
                    case "error":
                        sawTerminalEvent = true;
                        yield { type: "error", message: event.message };
                        break;
                }
            }
        }
    } catch (error) {
        // Aborting `signal` also aborts the underlying fetch, which rejects
        // an in-flight reader.read() with an AbortError - an expected
        // cancellation (e.g. the caller switched files), not a real
        // failure, so it shouldn't propagate as one.
        if (!signal?.aborted) throw error;
    } finally {
        // cancel() (not just releaseLock()) actually tears down the
        // underlying HTTP response - if we stopped early because `signal`
        // aborted, this is what stops ifc-lite-server from continuing to
        // send (and us from continuing to receive/buffer) a file nobody's
        // listening for anymore. A no-op if the stream already ended
        // naturally.
        await reader.cancel().catch(() => {});
    }

    if (!sawTerminalEvent && !signal?.aborted) {
        throw new Error(
            "IFC geometry stream ended before completion - the ifc-lite-server " +
                "connection was interrupted partway through parsing (e.g. out of memory)."
        );
    }
}

/**
 * Streams an IFC file's geometry via the self-hosted ifc-lite-server,
 * yielding Parquet-encoded batches as they're produced instead of buffering
 * the whole result - lets the frontend render large models progressively
 * instead of showing a blank viewer until parsing finishes. Tries
 * ifc-lite-server's own cache first (keyed by the file's content hash), so
 * re-viewing a file already parsed once skips the upload and the parse.
 * @param buffer - The raw IFC file content
 * @param signal - Aborted when the subscription's caller disconnects (e.g.
 * switches to a different file) - see streamFromUpload's doc comment for
 * why this needs to be threaded through explicitly.
 * @throws {Error} If the server is unreachable, the request fails, or the
 * stream ends without ever completing.
 */
async function* streamIfcFile(
    buffer: Buffer,
    signal?: AbortSignal
): AsyncGenerator<IfcGeometryStreamEvent> {
    const hash = createHash("sha256").update(buffer).digest("hex");

    const cached = await tryFetchCachedGeometry(hash, signal);
    if (cached) {
        yield* streamFromCache(cached);
        return;
    }

    yield* streamFromUpload(buffer, signal);
}

export { streamIfcFile, type IfcGeometryStreamEvent };
