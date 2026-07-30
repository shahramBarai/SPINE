import type { MeshData } from "@ifc-lite/geometry";

interface DecodeResponse {
    id: number;
    meshes?: MeshData[];
    done?: boolean;
    error?: string;
}

interface PendingRequest {
    onMeshes: (meshes: MeshData[]) => void;
    resolve: () => void;
    reject: (error: Error) => void;
}

interface IfcParquetDecoder {
    /**
     * Decodes one Parquet-encoded geometry blob off the main thread,
     * calling `onMeshes` with each group of renderer-ready MeshData as the
     * worker produces it (see the worker's MESH_GROUP_SIZE) rather than
     * waiting for the whole blob to finish decoding - lets the caller
     * render progressively, which matters most for a cache hit's geometry:
     * a single large, undivided blob that would otherwise show nothing
     * until it's entirely done.
     */
    decodeIfcGeometryBatch(
        base64Data: string,
        onMeshes: (meshes: MeshData[]) => void
    ): Promise<void>;
    /** Tears down the worker, reclaiming its WASM memory - see the module comment. */
    terminate(): void;
}

function createIfcParquetDecoder(): IfcParquetDecoder {
    const worker = new Worker(
        new URL("./ifcParquetDecoder.worker.ts", import.meta.url),
        { type: "module" }
    );

    const pending = new Map<number, PendingRequest>();
    let nextRequestId = 0;

    worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
        const { id, meshes, done, error } = event.data;
        const request = pending.get(id);
        if (!request) return;

        if (error) {
            pending.delete(id);
            request.reject(new Error(error));
            return;
        }

        if (meshes && meshes.length > 0) {
            request.onMeshes(meshes);
        }
        if (done) {
            pending.delete(id);
            request.resolve();
        }
    };

    worker.onerror = (event) => {
        // A worker-level error (e.g. failing to load the WASM module at
        // all) isn't tied to a specific request id - fail every request
        // still waiting rather than leaving them hanging forever.
        const error = new Error(
            event.message || "IFC geometry decode worker crashed"
        );
        for (const request of pending.values()) {
            request.reject(error);
        }
        pending.clear();
    };

    return {
        decodeIfcGeometryBatch(base64Data, onMeshes) {
            const id = nextRequestId++;

            return new Promise<void>((resolve, reject) => {
                pending.set(id, { onMeshes, resolve, reject });
                // The base64->bytes conversion also happens in the worker,
                // not here - it's a plain JS loop over potentially 100M+
                // characters for a cache hit's reassembled blob, genuinely
                // slow enough to freeze the tab on its own if run on this
                // thread (structured-cloning the string itself is
                // comparatively cheap - it's a native, optimized copy, not
                // a JS loop).
                worker.postMessage({ id, base64: base64Data });
            });
        },
        terminate() {
            worker.terminate();
            pending.clear();
        }
    };
}

export { createIfcParquetDecoder };
