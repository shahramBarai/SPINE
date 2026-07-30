import { GeometryProcessor, decodeInstancedShard } from "@ifc-lite/geometry";
import { Renderer } from "@ifc-lite/renderer";

export type LoadProgress = { phase: "parsing"; processed: number };

const ID_BLOCK_SIZE = 100_000_000;

interface LoadedModel {
    readonly offset: number;
    readonly expressIds: Set<number>;
    readonly ifcTypeByExpressId: Map<number, string | undefined>;
    complete: boolean;
}

class IfcViewer {
    private readonly renderer: Renderer;
    private readonly geometry: GeometryProcessor;
    private readonly loadedModels = new Map<string, LoadedModel>();
    private nextModelSlot = 0;
    private activeFileId: string | null = null;
    private activeIsolatedIds: Set<number> | null = null;

    onProgress?: (progress: LoadProgress) => void;

    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new Renderer(canvas);
        this.geometry = new GeometryProcessor();
    }

    async init(): Promise<void> {
        await this.renderer.init();
        await this.geometry.init();
    }

    getRenderer(): Renderer {
        return this.renderer;
    }

    getIfcType(expressId: number): string | undefined {
        if (!this.activeFileId) {
            return undefined;
        }
        return this.loadedModels
            .get(this.activeFileId)
            ?.ifcTypeByExpressId.get(expressId);
    }

    isLoaded(fileId: string): boolean {
        return this.loadedModels.get(fileId)?.complete === true;
    }

    /** IDs to pass as isolatedIds to both render() and pick() - keeping
     *  these in sync is what makes a hidden model's geometry unclickable,
     *  not just invisible (pick() doesn't inherit render()'s hidden/isolated
     *  state automatically - only section/clip state is auto-mirrored). */
    getIsolatedIds(): Set<number> | null {
        return this.activeIsolatedIds;
    }

    /** Makes `fileId` (already loaded) the only visible/pickable model. */
    showOnly(fileId: string): void {
        const model = this.loadedModels.get(fileId);
        if (!model) {
            return;
        }
        this.activeFileId = fileId;
        this.activeIsolatedIds = new Set(model.expressIds);
        this.renderer.fitToView();
    }

    /** Hides every loaded model (e.g. no file selected). */
    showNone(): void {
        this.activeFileId = null;
        this.activeIsolatedIds = new Set();
    }

    async loadFile(
        fileId: string,
        buffer: Uint8Array,
        signal?: AbortSignal
    ): Promise<void> {
        const offset = this.nextModelSlot++ * ID_BLOCK_SIZE;
        const model: LoadedModel = {
            offset,
            expressIds: new Set(),
            ifcTypeByExpressId: new Map(),
            complete: false
        };
        this.loadedModels.set(fileId, model);
        this.activeFileId = fileId;
        this.activeIsolatedIds = new Set();

        let hasFramedThisModel = false;

        for await (const event of this.geometry.processAdaptive(buffer)) {
            if (signal?.aborted) {
                break;
            }
            switch (event.type) {
                case "start":
                    this.onProgress?.({ phase: "parsing", processed: 0 });
                    break;
                case "batch": {
                    for (const mesh of event.meshes) {
                        mesh.expressId += offset;
                        model.expressIds.add(mesh.expressId);
                        model.ifcTypeByExpressId.set(
                            mesh.expressId,
                            mesh.ifcType
                        );
                    }
                    this.renderer.addMeshes(event.meshes, true);

                    if (event.instancedShards?.length) {
                        const device = this.renderer.getGPUDevice();
                        if (device) {
                            for (const shardBytes of event.instancedShards) {
                                const shard = decodeInstancedShard(shardBytes);
                                for (const instance of shard.instances) {
                                    instance.entityId += offset;
                                    model.expressIds.add(instance.entityId);
                                }
                                this.renderer
                                    .getScene()
                                    .addInstancedShard(device, shard);
                            }
                        }
                    }

                    // Keep the active isolate set in sync while this model
                    // is still streaming in (it's the active model for the
                    // whole duration of its own first load).
                    if (this.activeFileId === fileId) {
                        this.activeIsolatedIds = new Set(model.expressIds);
                    }

                    if (!hasFramedThisModel) {
                        hasFramedThisModel = true;
                        this.renderer.fitToView();
                    }

                    this.onProgress?.({
                        phase: "parsing",
                        processed: event.totalSoFar
                    });
                    break;
                }
                case "complete":
                    this.onProgress?.({
                        phase: "parsing",
                        processed: event.totalMeshes
                    });
                    break;
                default:
                    break;
            }
        }

        if (!signal?.aborted) {
            model.complete = true;
        }
    }

    destroy(): void {
        this.renderer.destroy();
    }
}

export { IfcViewer };
