import { IfcServerClient, type MeshData as ServerMeshData } from "@ifc-lite/server-client";
import { env } from "@spine/shared";

// Thin client for the self-hosted ifc-lite-server (see
// modules/modeling/docker-compose.yml) - lets us parse an IFC file's
// geometry server-side instead of shipping the raw file to the browser for
// client-side WASM parsing. Uses the SDK's plain JSON methods (parse,
// parseStream), not parseParquet()/parseParquetStream(): that decoder
// hard-codes a Vite-only `?url` wasm import and, separately, imports a
// parquet-wasm build layout that doesn't exist in the currently-published
// parquet-wasm - unusable from a plain Node process (and likely broken in
// the browser too, independent of that).

// Same camelCase shape @ifc-lite/geometry's own MeshData used to use
// client-side (see IfcViewerPane.tsx). Typed arrays are converted to plain
// arrays here since they cross the wire as tRPC/JSON.
interface NormalizedMeshData {
    expressId: number;
    ifcType?: string;
    positions: number[];
    normals: number[];
    indices: number[];
    color: [number, number, number, number];
}

// Mirrors @ifc-lite/server-client's StreamEvent union, camelCased and with
// meshes normalized the same way parse() results are.
type IfcGeometryStreamEvent =
    | { type: "start"; totalEstimate: number }
    | { type: "progress"; processed: number; total: number }
    | { type: "batch"; batchNumber: number; meshes: NormalizedMeshData[] }
    | { type: "complete"; totalMeshes: number }
    | { type: "error"; message: string };

const client = new IfcServerClient({ baseUrl: env.IFC_LITE_SERVER_URL });

function normalizeMesh(mesh: ServerMeshData): NormalizedMeshData {
    return {
        expressId: mesh.express_id,
        ifcType: mesh.ifc_type,
        positions: Array.from(mesh.positions),
        normals: Array.from(mesh.normals),
        indices: Array.from(mesh.indices),
        color: mesh.color
    };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
}

/**
 * Streams an IFC file's geometry via the self-hosted ifc-lite-server,
 * yielding batches of meshes as they're processed instead of buffering the
 * whole result - lets the frontend render large models progressively
 * instead of showing a blank viewer until parsing finishes.
 * @param buffer - The raw IFC file content
 * @throws {Error} If the server is unreachable, or the initial request fails
 */
async function* streamIfcFile(
    buffer: Buffer
): AsyncGenerator<IfcGeometryStreamEvent> {
    for await (const event of client.parseStream(toArrayBuffer(buffer))) {
        switch (event.type) {
            case "start":
                yield { type: "start", totalEstimate: event.total_estimate };
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
                    meshes: event.meshes.map(normalizeMesh)
                };
                break;
            case "complete":
                yield {
                    type: "complete",
                    totalMeshes: event.stats.total_meshes
                };
                break;
            case "error":
                yield { type: "error", message: event.message };
                break;
        }
    }
}

export { streamIfcFile, type NormalizedMeshData, type IfcGeometryStreamEvent };
