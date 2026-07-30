import { GeometryProcessor, decodeInstancedShard } from "@ifc-lite/geometry";
import { Renderer } from "@ifc-lite/renderer";
import {
    buildSunPathLines,
    computeDomeGeometry,
    parseSiteLatLong,
    type SiteLocation
} from "./sunPath";

export type LoadProgress = { phase: "parsing"; processed: number };
const ID_BLOCK_SIZE = 100_000_000;

interface LoadedModel {
    readonly offset: number;
    readonly expressIds: Set<number>;
    readonly ifcTypeByExpressId: Map<number, string | undefined>;
    complete: boolean;
    siteLocation: SiteLocation | null;
}
class IfcViewer {
    private static readonly MAX_TEXT_PARSE_BYTES = 480_000_000;

    private readonly renderer: Renderer;
    private readonly geometry: GeometryProcessor;
    private readonly loadedModels = new Map<string, LoadedModel>();
    private nextModelSlot = 0;
    private activeFileId: string | null = null;
    private activeIsolatedIds: Set<number> | null = null;
    private lastSunPathRequest: { site: SiteLocation; date: Date } | null =
        null;

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
        // Any sun path shown for the previously active model isn't
        // meaningful for this one (different bounds, usually different
        // site) - the UI re-opens it explicitly if the user wants one here.
        this.hideSunPath();
    }

    /** Hides every loaded model (e.g. no file selected). */
    showNone(): void {
        this.activeFileId = null;
        this.activeIsolatedIds = new Set();
        this.hideSunPath();
    }

    /** The active model's real-world site location, if IfcSite had one -
     *  purely for the UI to prefill its lat/lon inputs with a sensible
     *  default. null doesn't block showSunPathAt: the user can type in any
     *  location regardless of what (if anything) the file carries. */
    getSiteLocation(): SiteLocation | null {
        const model = this.activeFileId
            ? this.loadedModels.get(this.activeFileId)
            : undefined;
        return model?.siteLocation ?? null;
    }

    /** Shows the sun-path dome (graticule + day arc + a marker at the
     *  sun's exact position) for `site` as of `date`, sized to the active
     *  model's CURRENT bounds - which, if a model is still streaming in (or
     *  none has loaded at all yet), won't be its final size. Recomputed
     *  fresh on every call rather than cached (cheap: a few hundred line
     *  segments), and remembered so loadFile() can silently redo this once
     *  real bounds are ready - see `lastSunPathRequest`. */
    showSunPathAt(site: SiteLocation, date: Date): void {
        this.lastSunPathRequest = { site, date };
        const { radius, origin } = computeDomeGeometry(
            this.renderer.getModelBounds()
        );
        this.renderer.uploadAlignmentLines3D(
            buildSunPathLines(site, radius, origin, date)
        );
    }

    /** Hides the sun-path dome. Also forgets any pending request from
     *  showSunPathAt, so switching models (showOnly/showNone both call
     *  this) doesn't leave a stale one to replay against the new model. */
    hideSunPath(): void {
        this.lastSunPathRequest = null;
        this.renderer.uploadAlignmentLines3D(new Float32Array(0));
    }

    /** Parses the site's real-world lat/long out of the raw file text. Runs
     *  concurrently with mesh geometry streaming (never awaited before it),
     *  since it decodes the whole buffer as a string and re-parses it -
     *  gating first-batch render on this would undo the whole point of
     *  progressive streaming for a feature that's cosmetic on top. Resolves
     *  to null (not a throw) on any failure, since a missing/broken sun-path
     *  overlay should never take down the rest of the load.
     *
     * The lat/long regex match needs the whole file as one JS string, and
     * every V8-based engine (Node, Chrome, Edge - so this isn't Node-
     * specific) caps a string at ~536.8M UTF-16 code units (`0x1fffffe8`).
     * IFC STEP files are close enough to pure ASCII that byteLength is a
     * safe proxy for the resulting character count, so a file above
     * MAX_TEXT_PARSE_BYTES is skipped outright rather than attempted-and-
     * caught - this is a hard engine ceiling, not something a retry or
     * different decode would fix, so it gets a clear log line instead of
     * surfacing as a generic error. */
    private async loadSiteLocation(
        buffer: Uint8Array
    ): Promise<SiteLocation | null> {
        if (buffer.byteLength > IfcViewer.MAX_TEXT_PARSE_BYTES) {
            console.warn(
                `Skipping IfcSite location parsing: file is ` +
                    `${Math.round(buffer.byteLength / 1e6)}MB, over the ` +
                    `~${Math.round(IfcViewer.MAX_TEXT_PARSE_BYTES / 1e6)}MB ` +
                    "limit for decoding a whole file as one JS string."
            );
            return null;
        }
        try {
            const content = new TextDecoder().decode(buffer);
            return parseSiteLatLong(content);
        } catch (error) {
            console.error("Failed to parse IfcSite lat/long:", error);
            return null;
        }
    }

    /**
     * Parses `buffer` (a full IFC file) client-side and streams the result
     * into the renderer progressively via GeometryProcessor.processAdaptive -
     * small files parse synchronously and render in one batch, large files
     * stream batches from a worker pool as they're produced. `fileId` becomes
     * the active (visible/pickable) model immediately, so geometry appears as
     * it streams in rather than only once the whole file is parsed.
     *
     * `signal` has no direct hook into processAdaptive (it takes no abort
     * signal itself), so this checks it once per event and `break`s out of
     * the for-await loop - which calls the async generator's `.return()`,
     * the same mechanism a `for await...of` uses on any early exit. Without
     * this, switching files while a big model is still parsing would leave
     * its worker pool running to decode/upload batches for a file nobody's
     * viewing anymore (the same class of bug documented on the old
     * server-streaming subscription, just on the client side now).
     */
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
            complete: false,
            siteLocation: null
        };
        this.loadedModels.set(fileId, model);
        this.activeFileId = fileId;
        this.activeIsolatedIds = new Set();

        const siteLocationPromise = this.loadSiteLocation(buffer);

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

        model.siteLocation = await siteLocationPromise;

        if (!signal?.aborted) {
            model.complete = true;
            if (this.activeFileId === fileId && this.lastSunPathRequest) {
                this.showSunPathAt(
                    this.lastSunPathRequest.site,
                    this.lastSunPathRequest.date
                );
            }
        }
    }

    destroy(): void {
        this.renderer.destroy();
    }
}

export { IfcViewer };
