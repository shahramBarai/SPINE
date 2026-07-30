import type { MeshData } from "@ifc-lite/geometry";

// Runs the actual Parquet/Arrow decode off the main thread. This is
// genuinely CPU-heavy - WASM parsing plus reconstructing typed arrays over
// potentially hundreds of thousands of vertices - and async/await alone
// doesn't help with that: it only yields control at `await` points, so
// without a worker this blocks rendering and all user input for however
// long a decode takes (worst case: a cache hit's entire geometry, decoded
// as one unit - see ifcLiteServerClient.ts on the backend for why that's
// one big blob rather than several small ones).

// This file runs in a worker global scope, not a window - declaring just
// the two members we actually use rather than pulling in the full
// "webworker" lib, which would conflict with this project's tsconfig
// targeting "DOM" (both declare an incompatible global `self`).
declare const self: {
    onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
    postMessage(message: DecodeResponse, transfer?: Transferable[]): void;
};

interface DecodeRequest {
    id: number;
    base64: string;
}

// `meshes`/`done: false` can be sent multiple times per request (see
// MESH_GROUP_SIZE) before a final `done: true` - lets the main thread start
// rendering before the whole blob is decoded, rather than only once
// everything is ready.
type DecodeResponse =
    | { id: number; meshes: MeshData[]; done: boolean }
    | { id: number; error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParquetWasmModule = any;

let parquetWasmPromise: Promise<ParquetWasmModule> | null = null;

// wasm-pack's ESM/bundler build needs an explicit async init call before any
// of its functions can be used - Vite's `?url` import resolves the .wasm
// file to a fetchable URL at build time, which is exactly what init()
// expects. Works the same way inside a module worker as on the main thread.
function loadParquetWasm(): Promise<ParquetWasmModule> {
    if (!parquetWasmPromise) {
        parquetWasmPromise = (async () => {
            const mod = await import("parquet-wasm/esm/parquet_wasm.js");
            const wasmUrl = (
                await import("parquet-wasm/esm/parquet_wasm_bg.wasm?url")
            ).default;
            await mod.default(wasmUrl);
            return mod;
        })();
    }
    return parquetWasmPromise;
}

// Meshes are handed to `onGroup` in batches of this size rather than all at
// once, so the main thread can start rendering before the whole blob (which
// for a cache hit can be the entire model, undivided - see the module
// comment) finishes decoding.
const MESH_GROUP_SIZE = 200;

/**
 * Decodes one Parquet-encoded geometry blob into renderer-ready MeshData,
 * calling `onGroup` with each group of MESH_GROUP_SIZE meshes as they're
 * built rather than returning the whole array at the end.
 *
 * Wire format: `[mesh_len:u32][mesh_data][vertex_len:u32][vertex_data][index_len:u32][index_data]`,
 * each section itself a Parquet table (mirrors ifc-lite-server's own
 * `@ifc-lite/server-client` decoder, which can't be used as-is - its
 * bundled build references parquet-wasm files that don't exist in the
 * currently-published parquet-wasm).
 */
async function decodeGeometry(
    data: Uint8Array,
    onGroup: (meshes: MeshData[]) => void
): Promise<void> {
    const parquet = await loadParquetWasm();

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    const meshLen = view.getUint32(offset, true);
    offset += 4;
    const meshBytes = data.subarray(offset, offset + meshLen);
    offset += meshLen;

    const vertexLen = view.getUint32(offset, true);
    offset += 4;
    const vertexBytes = data.subarray(offset, offset + vertexLen);
    offset += vertexLen;

    const indexLen = view.getUint32(offset, true);
    offset += 4;
    const indexBytes = data.subarray(offset, offset + indexLen);

    const meshTable = parquet.readParquet(meshBytes);
    const vertexTable = parquet.readParquet(vertexBytes);
    const indexTable = parquet.readParquet(indexBytes);

    // apache-arrow's export map hides its .d.ts from TS5's strict resolver.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arrow: any = await import("apache-arrow");
    const meshArrow = arrow.tableFromIPC(meshTable.intoIPCStream());
    const vertexArrow = arrow.tableFromIPC(vertexTable.intoIPCStream());
    const indexArrow = arrow.tableFromIPC(indexTable.intoIPCStream());

    const expressIds = meshArrow.getChild("express_id")?.toArray();
    const ifcTypes = meshArrow.getChild("ifc_type");
    const vertexStarts = meshArrow.getChild("vertex_start")?.toArray();
    const vertexCounts = meshArrow.getChild("vertex_count")?.toArray();
    const indexStarts = meshArrow.getChild("index_start")?.toArray();
    const indexCounts = meshArrow.getChild("index_count")?.toArray();
    const colorR = meshArrow.getChild("color_r")?.toArray();
    const colorG = meshArrow.getChild("color_g")?.toArray();
    const colorB = meshArrow.getChild("color_b")?.toArray();
    const colorA = meshArrow.getChild("color_a")?.toArray();

    const posX = vertexArrow.getChild("x")?.toArray();
    const posY = vertexArrow.getChild("y")?.toArray();
    const posZ = vertexArrow.getChild("z")?.toArray();
    const normX = vertexArrow.getChild("nx")?.toArray();
    const normY = vertexArrow.getChild("ny")?.toArray();
    const normZ = vertexArrow.getChild("nz")?.toArray();

    const idx0 = indexArrow.getChild("i0")?.toArray();
    const idx1 = indexArrow.getChild("i1")?.toArray();
    const idx2 = indexArrow.getChild("i2")?.toArray();

    if (
        !posX ||
        !posY ||
        !posZ ||
        !normX ||
        !normY ||
        !normZ ||
        !idx0 ||
        !idx1 ||
        !idx2
    ) {
        throw new Error(
            "Malformed Parquet geometry: missing required vertex/index column"
        );
    }

    const meshCount = expressIds.length;
    let group: MeshData[] = [];

    for (let i = 0; i < meshCount; i++) {
        const vertexStart = vertexStarts[i];
        const vertexCount = vertexCounts[i];
        const indexStart = indexStarts[i];
        const indexCount = indexCounts[i];

        if (
            vertexStart + vertexCount > posX.length ||
            vertexStart + vertexCount > normX.length ||
            indexStart % 3 !== 0 ||
            indexCount % 3 !== 0 ||
            (indexStart + indexCount) / 3 > idx0.length
        ) {
            throw new Error(
                `Malformed Parquet geometry: mesh ${i} range out of bounds`
            );
        }

        const positions = new Float32Array(vertexCount * 3);
        const normals = new Float32Array(vertexCount * 3);
        for (let v = 0; v < vertexCount; v++) {
            const srcIdx = vertexStart + v;
            positions[v * 3] = posX[srcIdx];
            positions[v * 3 + 1] = posY[srcIdx];
            positions[v * 3 + 2] = posZ[srcIdx];
            normals[v * 3] = normX[srcIdx];
            normals[v * 3 + 1] = normY[srcIdx];
            normals[v * 3 + 2] = normZ[srcIdx];
        }

        const triangleCount = indexCount / 3;
        const triangleStart = indexStart / 3;
        const indices = new Uint32Array(indexCount);
        for (let t = 0; t < triangleCount; t++) {
            const srcIdx = triangleStart + t;
            indices[t * 3] = idx0[srcIdx];
            indices[t * 3 + 1] = idx1[srcIdx];
            indices[t * 3 + 2] = idx2[srcIdx];
        }

        group.push({
            expressId: expressIds[i],
            ifcType: ifcTypes?.get(i) ?? "Unknown",
            positions,
            normals,
            indices,
            color: [colorR[i], colorG[i], colorB[i], colorA[i]]
        });

        if (group.length >= MESH_GROUP_SIZE) {
            onGroup(group);
            group = [];
        }
    }

    if (group.length > 0) {
        onGroup(group);
    }
}

function postGroup(id: number, meshes: MeshData[], done: boolean): void {
    const transfer: Transferable[] = [];
    for (const mesh of meshes) {
        transfer.push(
            mesh.positions.buffer,
            mesh.normals.buffer,
            mesh.indices.buffer
        );
    }
    self.postMessage({ id, meshes, done }, transfer);
}

// atob() itself is fast (native), but turning its result into a byte array
// one char at a time is a plain JS loop over potentially 100M+ iterations
// for a cache hit's reassembled blob - genuinely slow, and this used to run
// on the *main thread* before being handed off here, which defeated the
// point of decoding in a worker: the tab would still freeze for however
// long this loop took, before WASM decode had even started.
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

self.onmessage = (event) => {
    const { id, base64 } = event.data;

    // Wrapped in Promise.resolve().then(...) so a synchronous throw from
    // base64ToBytes (e.g. malformed input) rejects like any other decode
    // failure instead of escaping as an uncaught exception in the handler.
    Promise.resolve()
        .then(() => base64ToBytes(base64))
        .then((bytes) =>
            decodeGeometry(bytes, (group) => postGroup(id, group, false))
        )
        .then(() => postGroup(id, [], true))
        .catch((error: unknown) => {
            self.postMessage({
                id,
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to decode IFC geometry"
            });
        });
};
