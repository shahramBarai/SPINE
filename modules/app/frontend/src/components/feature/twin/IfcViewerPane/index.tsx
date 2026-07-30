import { useEffect, useRef, useState } from "react";
import { Box, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "utils/index";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { buildProjectFileUrl } from "utils/projectFileUrl";
import { IfcViewer } from "./ifcViewer";
import { IfcLoadStatusBar, type LoadState } from "./IfcLoadStatusBar";

interface SelectedElement {
    expressId: number;
    ifcType?: string;
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

async function downloadWithProgress(
    url: string,
    signal: AbortSignal,
    onProgress: (loadedBytes: number, totalBytes: number | null) => void
): Promise<Uint8Array> {
    const response = await fetch(url, { credentials: "include", signal });
    if (!response.ok || !response.body) {
        throw new Error(
            `Failed to download IFC file (status ${response.status})`
        );
    }

    const contentLength = response.headers.get("Content-Length");
    const total = contentLength ? Number(contentLength) : null;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(loaded, total);
    }

    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return buffer;
}

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
    const mountRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<IfcViewer | null>(null);
    // Selection lives outside React state (read directly by the animate
    // loop's render() call each frame) so highlighting a click doesn't need
    // to tear down/recreate the render loop's closure.
    const selectionRef = useRef<{ selectedExpressId: number | null }>({
        selectedExpressId: null
    });
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

        const viewer = new IfcViewer(canvas);

        function resize() {
            const { clientWidth, clientHeight } = mount!;
            if (clientWidth === 0 || clientHeight === 0) {
                return;
            }
            const dpr = Math.min(window.devicePixelRatio, 2);
            viewer
                .getRenderer()
                .resize(
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
            const camera = viewer.getRenderer().getCamera();
            if (isOrbiting) {
                camera.orbit(deltaX, deltaY);
            } else {
                camera.pan(deltaX, deltaY);
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
            viewer
                .getRenderer()
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
            // pick() doesn't inherit render()'s hidden/isolated state
            // automatically (only section/clip state is auto-mirrored), so
            // the same isolatedIds has to be passed here too - otherwise a
            // click could select an element belonging to a hidden (inactive)
            // cached model right through the visible one.
            const hit = await viewer
                .getRenderer()
                .pick(event.clientX - rect.left, event.clientY - rect.top, {
                    isolatedIds: viewer.getIsolatedIds() ?? undefined
                });
            if (disposed) {
                return;
            }
            if (hit) {
                selectionRef.current.selectedExpressId = hit.expressId;
                setSelectedElement({
                    expressId: hit.expressId,
                    ifcType: viewer.getIfcType(hit.expressId)
                });
            } else {
                selectionRef.current.selectedExpressId = null;
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
            const renderer = viewer.getRenderer();
            renderer.getCamera().update(deltaTime);
            renderer.render({
                clearColor: CLEAR_COLOR,
                isolatedIds: viewer.getIsolatedIds() ?? undefined,
                selectedIds:
                    selectionRef.current.selectedExpressId !== null
                        ? new Set([selectionRef.current.selectedExpressId])
                        : undefined
            });
        }

        (async () => {
            try {
                await viewer.init();
                if (disposed) {
                    viewer.destroy();
                    return;
                }
                viewer.getRenderer().setOverlayLineColor(GRID_COLOR);
                viewer
                    .getRenderer()
                    .uploadGridLines3D(buildGroundGridLines(100, 100));
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
            viewer.destroy();
            if (canvas.parentElement === mount) {
                mount.removeChild(canvas);
            }
        };
    }, []);

    // Model selection: switches which already-mounted renderer's model is
    // visible/pickable whenever the selected file changes. A file already
    // loaded this session is never re-downloaded or re-parsed - it's just a
    // different isolatedIds Set (see IfcViewer.showOnly) - so reselecting a
    // previously viewed file is instant. Only a genuinely new file goes
    // through the download+parse path below.
    useEffect(() => {
        setSelectedElement(null);
        selectionRef.current.selectedExpressId = null;

        let disposed = false;
        const controller = new AbortController();

        const viewer = viewerRef.current;
        if (!viewer) {
            return;
        }

        if (!selectedIfcFile) {
            viewer.showNone();
            setLoadState(null);
            return;
        }

        if (viewer.isLoaded(selectedIfcFile.fileId)) {
            viewer.showOnly(selectedIfcFile.fileId);
            setLoadState(null);
            return;
        }

        setLoadState({ status: "connecting" });

        viewer.onProgress = (progress) => {
            if (disposed) {
                return;
            }
            setLoadState({
                status: "processing",
                processed: progress.processed
            });
        };

        (async () => {
            try {
                const objectKey = `${projectInfo.id}/${selectedIfcFile.discipline}/${selectedIfcFile.fileId}`;
                const buffer = await downloadWithProgress(
                    buildProjectFileUrl(objectKey),
                    controller.signal,
                    (loadedBytes, totalBytes) => {
                        if (disposed) {
                            return;
                        }
                        setLoadState({
                            status: "downloading",
                            processed: loadedBytes,
                            total: totalBytes
                        });
                    }
                );
                if (disposed) {
                    return;
                }

                setLoadState({ status: "processing", processed: 0 });
                await viewer.loadFile(
                    selectedIfcFile.fileId,
                    buffer,
                    controller.signal
                );
                if (!disposed) {
                    setLoadState(null);
                }
            } catch (error) {
                if (disposed || controller.signal.aborted) {
                    return;
                }
                console.error("Failed to load IFC file:", error);
                setLoadState({
                    status: "error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to load 3D geometry."
                });
            }
        })();

        return () => {
            disposed = true;
            controller.abort();
            viewer.onProgress = undefined;
        };
    }, [selectedIfcFile, projectInfo.id]);

    function handleDismissError() {
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

            <IfcLoadStatusBar
                loadState={loadState}
                fileName={selectedIfcFile?.fileName}
                onDismissError={handleDismissError}
            />
        </div>
    );
}

export { IfcViewerPane };
