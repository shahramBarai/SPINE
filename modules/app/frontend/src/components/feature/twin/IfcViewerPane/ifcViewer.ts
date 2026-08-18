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

/**
 * Wraps the renderer + geometry-processing lifecycle for one canvas.
 * Parsing runs client-side via GeometryProcessor's WASM worker pool, which
 * is what makes GPU instancing available at all (instanced shards are only
 * ever produced by this in-browser pipeline, never by ifc-lite-server's
 * HTTP API).
 *
 * Loaded models stay resident for the viewer's lifetime - re-showing a file
 * already seen this session is instant (no re-download, no re-parse), just
 * a different isolatedIds union handed to render()/pick(). Any number of
 * loaded models can be visible at once; expressIds are offset into disjoint
 * per-model ranges (see ID_BLOCK_SIZE) so overlapping IDs from different
 * files never collide once several are resident together.
 */
class IfcViewer {
    private static readonly MAX_TEXT_PARSE_BYTES = 480_000_000;

    private readonly renderer: Renderer;
    private readonly geometry: GeometryProcessor;
    private readonly loadedModels = new Map<string, LoadedModel>();
    private nextModelSlot = 0;
    private visibleFileIds = new Set<string>();
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

    /** Looks up an expressId across every loaded model (offsets keep them
     *  unambiguous - only one model can ever own a given id). */
    getIfcType(expressId: number): string | undefined {
        for (const model of this.loadedModels.values()) {
            const type = model.ifcTypeByExpressId.get(expressId);
            if (type !== undefined) {
                return type;
            }
        }
        return undefined;
    }

    isLoaded(fileId: string): boolean {
        return this.loadedModels.get(fileId)?.complete === true;
    }

    /** IDs to pass as isolatedIds to both render() and pick() - pick()
     *  doesn't inherit render()'s hidden/isolated state automatically. */
    getIsolatedIds(): Set<number> | null {
        return this.activeIsolatedIds;
    }

    /**
     * Sets which loaded models are visible/pickable, replacing whatever
     * was visible before. Files not yet loaded are silently ignored here -
     * loadFile() adds itself to the visible set and unions its own
     * expressIds in as they stream in. Never reframes the camera - toggling
     * visibility shouldn't move it; a newly loading file frames itself once
     * on its first batch (see loadFile).
     */
    setVisibleFiles(fileIds: Iterable<string>): void {
        this.visibleFileIds = new Set(fileIds);
        this.recomputeIsolatedIds();
    }

    private recomputeIsolatedIds(): void {
        const union = new Set<number>();
        for (const fileId of this.visibleFileIds) {
            const model = this.loadedModels.get(fileId);
            if (model) {
                for (const id of model.expressIds) {
                    union.add(id);
                }
            }
        }
        this.activeIsolatedIds = union;
    }

    /** The first visible model's detected IfcSite location, if any - purely
     *  to prefill the sun-path UI's lat/lon inputs. */
    getSiteLocation(): SiteLocation | null {
        for (const fileId of this.visibleFileIds) {
            const location = this.loadedModels.get(fileId)?.siteLocation;
            if (location) {
                return location;
            }
        }
        return null;
    }

    /**
     * Shows the sun-path dome (graticule + day arc + a marker at the sun's
     * exact position) for `site` as of `date`, sized to the current
     * (possibly still-growing) model bounds. Recomputed fresh on every call
     * rather than cached, and remembered so loadFile() can silently redo
     * this once bounds are final - see `lastSunPathRequest`.
     */
    showSunPathAt(site: SiteLocation, date: Date): void {
        this.lastSunPathRequest = { site, date };
        const { radius, origin } = computeDomeGeometry(
            this.renderer.getModelBounds()
        );
        this.renderer.uploadAlignmentLines3D(
            buildSunPathLines(site, radius, origin, date)
        );
    }

    hideSunPath(): void {
        this.lastSunPathRequest = null;
        this.renderer.uploadAlignmentLines3D(new Float32Array(0));
    }

    /**
     * Parses the site's real-world lat/long out of the raw file text.
     * Resolves to null (not a throw) on any failure - a missing/broken
     * sun-path overlay should never take down the rest of the load.
     *
     * The lat/long regex match needs the whole file as one JS string, and
     * every V8-based engine caps a string at ~536.8M UTF-16 code units, so
     * a file above MAX_TEXT_PARSE_BYTES is skipped outright.
     */
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
     * into the renderer progressively via GeometryProcessor.processAdaptive.
     * Assumes the caller has already included `fileId` in setVisibleFiles()
     * before calling this - it never adds itself to the visible set, so a
     * toggle-off that happens mid-load (a later setVisibleFiles call
     * without this fileId) is respected rather than overridden once this
     * catches up.
     *
     * `signal` has no direct hook into processAdaptive, so this checks it
     * once per event and `break`s out of the for-await loop - which calls
     * the async generator's `.return()`, stopping its worker pool instead
     * of letting it run to completion for a file nobody's viewing anymore.
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

                    if (this.visibleFileIds.has(fileId)) {
                        this.recomputeIsolatedIds();
                        if (!hasFramedThisModel) {
                            hasFramedThisModel = true;
                            this.renderer.fitToView();
                        }
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
            if (this.lastSunPathRequest) {
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
