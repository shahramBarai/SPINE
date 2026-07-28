import { useEffect, useRef, useState } from "react";
import { Box, Loader2, AlertTriangle, X, Maximize2, Minimize2 } from "lucide-react";
import { Renderer } from "@ifc-lite/renderer";
import type { MeshData } from "@ifc-lite/geometry";
import { cn } from "utils/index";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { api } from "utils/trpc";

type LoadState =
    | { status: "connecting" }
    | { status: "streaming"; processed: number; total: number }
    | { status: "error"; message: string };

interface SelectedElement {
    expressId: number;
    ifcType?: string;
}

// Shape of a mesh returned by the streamIfcGeometry tRPC subscription -
// typed arrays don't survive the tRPC/JSON wire, so fields cross as plain
// number[].
interface ServerMeshData {
    expressId: number;
    ifcType?: string;
    positions: number[];
    normals: number[];
    indices: number[];
    color: [number, number, number, number];
}

function toMeshData(mesh: ServerMeshData): MeshData {
    return {
        expressId: mesh.expressId,
        ifcType: mesh.ifcType,
        positions: Float32Array.from(mesh.positions),
        normals: Float32Array.from(mesh.normals),
        indices: Uint32Array.from(mesh.indices),
        color: mesh.color
    };
}

// Ground reference grid, built by hand since the renderer has no built-in
// helper for one (unlike Three.js's GridHelper) - fed through
// uploadGridLines3D(), which the renderer otherwise reserves for IfcGridAxis
// data. Doesn't affect model bounds/fitToView (see that method's docs), so
// it's safe to upload once and leave in place permanently.
function buildGroundGridLines(size: number, divisions: number): Float32Array {
    const half = size / 2;
    const step = size / divisions;
    const lines: number[] = [];
    for (let i = 0; i <= divisions; i++) {
        const pos = -half + i * step;
        lines.push(-half, 0, pos, half, 0, pos);
        lines.push(pos, 0, -half, pos, 0, half);
    }
    return Float32Array.from(lines);
}

const CLEAR_COLOR: [number, number, number, number] = [0.165, 0.176, 0.204, 1];
const GRID_COLOR: [number, number, number, number] = [0.35, 0.37, 0.42, 1];
// Ignore the click that ends a drag (orbit/pan) - without this, releasing
// the mouse after orbiting spuriously picks whatever ended up under the
// cursor.
const CLICK_DRAG_THRESHOLD_PX = 4;

// Mutable renderer state shared between the scene-lifecycle effect (mounts
// once, tears down on unmount) and the model-loading effect (re-runs per
// selected file) - so loading a new file doesn't recreate the renderer, it
// just clears and repopulates this.
interface ViewerState {
    renderer: Renderer;
    ifcTypeByExpressId: Map<number, string | undefined>;
    hasFramedCamera: boolean;
    selectedExpressId: number | null;
}

function clearViewerModel(viewer: ViewerState) {
    // Scene.clear() frees the GPU buffers; addMeshes()/loadGeometry() have no
    // "replace" mode (they only append). Model bounds are tracked separately
    // on the renderer and only ever expand (see updateModelBounds), so they
    // need resetting to the same [Infinity, -Infinity] sentinel the renderer
    // itself starts from - otherwise fitToView() on the next file would frame
    // a box that still includes the previous model's extents.
    viewer.renderer.getScene().clear();
    viewer.renderer.setModelBounds({
        min: { x: Infinity, y: Infinity, z: Infinity },
        max: { x: -Infinity, y: -Infinity, z: -Infinity }
    });
    viewer.renderer.getCamera().setSceneBounds(null);
    viewer.ifcTypeByExpressId.clear();
    viewer.hasFramedCamera = false;
    viewer.selectedExpressId = null;
}

// Real "3D Viewer" pane, replacing PlaceholderPane. The renderer (grid,
// camera, lighting) mounts once and always stays visible, independent of
// whether a file is selected. Loading a file subscribes to the
// streamIfcGeometry procedure, which asks the backend to parse it via the
// self-hosted ifc-lite-server and streams meshes back in batches as they're
// processed - raw IFC bytes never reach the browser, and large files render
// progressively instead of the viewer staying blank until the whole file is
// parsed. No client-side parsing fallback: if the server is unavailable,
// show an error rather than shipping the file to the browser (see
// ifcLiteServerClient.ts). Rendering is on @ifc-lite/renderer (WebGPU) - no
// WebGL fallback, so this requires a WebGPU-capable browser. No property
// panel or per-element visibility toggles yet (a later pass); this is
// click-to-select (highlights the clicked element and shows its
// type/expressId) plus orbit/pan/zoom.
function IfcViewerPane({
    hidden,
    maximized,
    onToggleMaximize
}: {
    hidden?: boolean;
    maximized: boolean;
    onToggleMaximize: () => void;
}) {
    const { projectInfo, selectedIfcFile } = useDigitalTwin();
    const utils = api.useUtils();
    const mountRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<ViewerState | null>(null);
    const subscriptionRef = useRef<{ unsubscribe(): void } | null>(null);
    const [loadState, setLoadState] = useState<LoadState | null>(null);
    const [selectedElement, setSelectedElement] =
        useState<SelectedElement | null>(null);

    // Scene lifecycle: mounts the renderer once and keeps it alive (and
    // rendering) for as long as the pane exists, so the grid is always
    // there even before/after a file is selected.
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) {
            return;
        }

        let disposed = false;

        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        mount.appendChild(canvas);

        const renderer = new Renderer(canvas);
        const viewer: ViewerState = {
            renderer,
            ifcTypeByExpressId: new Map(),
            hasFramedCamera: false,
            selectedExpressId: null
        };

        function resize() {
            const { clientWidth, clientHeight } = mount!;
            if (clientWidth === 0 || clientHeight === 0) {
                return;
            }
            const dpr = Math.min(window.devicePixelRatio, 2);
            renderer.resize(
                Math.round(clientWidth * dpr),
                Math.round(clientHeight * dpr)
            );
        }
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();

        let isOrbiting = false;
        let isPanning = false;
        let lastX = 0;
        let lastY = 0;
        let dragDistance = 0;

        function handlePointerDown(event: PointerEvent) {
            if (event.button === 0) {
                isOrbiting = true;
            } else if (event.button === 1 || event.button === 2) {
                isPanning = true;
            } else {
                return;
            }
            lastX = event.clientX;
            lastY = event.clientY;
            dragDistance = 0;
            canvas.setPointerCapture(event.pointerId);
        }
        function handlePointerMove(event: PointerEvent) {
            if (!isOrbiting && !isPanning) {
                return;
            }
            const deltaX = event.clientX - lastX;
            const deltaY = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            dragDistance += Math.abs(deltaX) + Math.abs(deltaY);
            if (isOrbiting) {
                renderer.getCamera().orbit(deltaX, deltaY);
            } else {
                renderer.getCamera().pan(deltaX, deltaY);
            }
        }
        function handlePointerUp(event: PointerEvent) {
            isOrbiting = false;
            isPanning = false;
            canvas.releasePointerCapture(event.pointerId);
        }
        function handleWheel(event: WheelEvent) {
            event.preventDefault();
            const rect = canvas.getBoundingClientRect();
            renderer
                .getCamera()
                .zoom(
                    event.deltaY,
                    false,
                    event.clientX - rect.left,
                    event.clientY - rect.top,
                    canvas.clientWidth,
                    canvas.clientHeight
                );
        }
        function handleContextMenu(event: MouseEvent) {
            event.preventDefault();
        }
        async function handleClick(event: MouseEvent) {
            if (dragDistance > CLICK_DRAG_THRESHOLD_PX) {
                return;
            }
            const rect = canvas.getBoundingClientRect();
            const hit = await renderer.pick(
                event.clientX - rect.left,
                event.clientY - rect.top
            );
            if (disposed) {
                return;
            }
            if (hit) {
                viewer.selectedExpressId = hit.expressId;
                setSelectedElement({
                    expressId: hit.expressId,
                    ifcType: viewer.ifcTypeByExpressId.get(hit.expressId)
                });
            } else {
                viewer.selectedExpressId = null;
                setSelectedElement(null);
            }
        }

        canvas.addEventListener("pointerdown", handlePointerDown);
        canvas.addEventListener("pointermove", handlePointerMove);
        canvas.addEventListener("pointerup", handlePointerUp);
        canvas.addEventListener("wheel", handleWheel, { passive: false });
        canvas.addEventListener("contextmenu", handleContextMenu);
        canvas.addEventListener("click", handleClick);

        let animationFrame = 0;
        let lastTime = performance.now();
        function animate() {
            animationFrame = requestAnimationFrame(animate);
            const now = performance.now();
            const deltaTime = (now - lastTime) / 1000;
            lastTime = now;
            renderer.getCamera().update(deltaTime);
            renderer.render({
                clearColor: CLEAR_COLOR,
                selectedIds:
                    viewer.selectedExpressId !== null
                        ? new Set([viewer.selectedExpressId])
                        : undefined
            });
        }

        (async () => {
            try {
                await renderer.init();
                if (disposed) {
                    renderer.destroy();
                    return;
                }
                renderer.setOverlayLineColor(GRID_COLOR);
                renderer.uploadGridLines3D(buildGroundGridLines(100, 100));
                viewerRef.current = viewer;
                animate();
            } catch (error) {
                console.error("Failed to initialize WebGPU renderer:", error);
                if (!disposed) {
                    setLoadState({
                        status: "error",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Failed to initialize the 3D renderer (WebGPU may be unavailable in this browser)."
                    });
                }
            }
        })();

        return () => {
            disposed = true;
            cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            canvas.removeEventListener("pointerdown", handlePointerDown);
            canvas.removeEventListener("pointermove", handlePointerMove);
            canvas.removeEventListener("pointerup", handlePointerUp);
            canvas.removeEventListener("wheel", handleWheel);
            canvas.removeEventListener("contextmenu", handleContextMenu);
            canvas.removeEventListener("click", handleClick);
            viewerRef.current = null;
            renderer.destroy();
            if (canvas.parentElement === mount) {
                mount.removeChild(canvas);
            }
        };
    }, []);

    // Model loading: swaps out the geometry in the (already-mounted)
    // renderer whenever the selected file changes.
    useEffect(() => {
        setSelectedElement(null);

        let disposed = false;

        const viewer = viewerRef.current;
        if (!viewer) {
            return;
        }

        clearViewerModel(viewer);

        if (!selectedIfcFile) {
            setLoadState(null);
            return;
        }

        setLoadState({ status: "connecting" });

        const subscription = utils.client.digitalTwin.streamIfcGeometry.subscribe(
            {
                projectId: projectInfo.id,
                fileId: selectedIfcFile.fileId
            },
            {
                onData(event) {
                    if (disposed) {
                        return;
                    }
                    switch (event.type) {
                        case "start":
                            setLoadState({
                                status: "streaming",
                                processed: 0,
                                total: event.totalEstimate
                            });
                            break;
                        case "progress":
                            setLoadState({
                                status: "streaming",
                                processed: event.processed,
                                total: event.total
                            });
                            break;
                        case "batch": {
                            const meshes = event.meshes.map(toMeshData);
                            for (const mesh of meshes) {
                                viewer.ifcTypeByExpressId.set(
                                    mesh.expressId,
                                    mesh.ifcType
                                );
                            }
                            viewer.renderer.addMeshes(meshes, true);
                            if (!viewer.hasFramedCamera) {
                                viewer.hasFramedCamera = true;
                                viewer.renderer.fitToView();
                            }
                            break;
                        }
                        case "complete":
                            setLoadState(null);
                            break;
                        case "error":
                            setLoadState({
                                status: "error",
                                message: event.message
                            });
                            break;
                    }
                },
                onError(error) {
                    console.error(error);
                    if (!disposed) {
                        setLoadState({
                            status: "error",
                            message: error.message || "Failed to load 3D geometry."
                        });
                    }
                }
            }
        );
        subscriptionRef.current = subscription;

        return () => {
            disposed = true;
            subscriptionRef.current?.unsubscribe();
            subscriptionRef.current = null;
        };
    }, [selectedIfcFile, projectInfo.id]);

    function handleDismissError() {
        subscriptionRef.current?.unsubscribe();
        setLoadState(null);
    }

    return (
        <div
            className={cn(
                "relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-card/40",
                hidden ? "hidden" : ""
            )}
            aria-label="3D Viewer"
            aria-hidden={hidden}
        >
            <div
                className={cn(
                    "absolute top-2 left-3 z-20",
                    "flex items-center gap-2 px-3 py-2",
                    "rounded-md bg-surface text-surface-foreground",
                    "border border-border/60"
                )}
            >
                <Box className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    3D Viewer
                </span>
                {selectedElement && (
                    <span className="normal-case tracking-normal text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
                        {selectedElement.ifcType ?? "Element"} #
                        {selectedElement.expressId}
                    </span>
                )}
            </div>

            <button
                onClick={onToggleMaximize}
                className={cn(
                    "absolute top-3 right-3 z-20",
                    "h-7 w-7 flex items-center justify-center",
                    "bg-surface/50 text-surface-foreground rounded",
                    "border border-border/60",
                    "hover:cursor-pointer hover:text-primary hover:bg-primary/10"
                )}
                aria-label={maximized ? "Restore" : "Maximize"}
            >
                {maximized ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                )}
            </button>

            <div ref={mountRef} className="h-full w-full" />

            {!selectedIfcFile && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Select an IFC file from the sidebar to view it here.
                </div>
            )}

            {loadState && (
                <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-md border border-border/60 bg-surface/90 px-3 py-2 text-surface-foreground">
                    {loadState.status === "error" ? (
                        <>
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />
                            <span className="flex-1 truncate text-[10px] font-mono text-danger">
                                {loadState.message}
                            </span>
                            <button
                                type="button"
                                onClick={handleDismissError}
                                className="shrink-0 rounded p-0.5 hover:cursor-pointer hover:bg-secondary/60"
                                aria-label="Dismiss error"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                                {selectedIfcFile?.fileName}
                                {loadState.status === "streaming" &&
                                    loadState.total > 0 &&
                                    ` — ${Math.min(
                                        100,
                                        Math.round(
                                            (loadState.processed /
                                                loadState.total) *
                                                100
                                        )
                                    )}%`}
                            </span>
                            {loadState.status === "streaming" &&
                                loadState.total > 0 && (
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                                        <div
                                            className="h-full rounded-full bg-primary transition-[width]"
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    (loadState.processed /
                                                        loadState.total) *
                                                        100
                                                )}%`
                                            }}
                                        />
                                    </div>
                                )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export { IfcViewerPane };
