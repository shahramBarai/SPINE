import { useEffect, useRef, useState } from "react";
import {
    Box,
    Maximize2,
    Minimize2,
    EyeOff,
    Eye,
    Focus,
    Sun
} from "lucide-react";
import { cn } from "utils/index";
import { useDigitalTwin, type SelectedIfcFile } from "hooks/useDigitalTwin";
import { useTheme } from "hooks/useTheme";
import { buildProjectFileUrl } from "utils/projectFileUrl";
import { IfcViewer } from "./ifcViewer";
import { IfcLoadStatusBar, type LoadState } from "./IfcLoadStatusBar";
import { SunPanel } from "./SunPanel";
import type { SiteLocation } from "./sunPath";

interface SelectedElement {
    expressId: number;
    ifcType?: string;
}

function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
    const normalized = hex.replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    return [r, g, b, alpha];
}

/** Mirrors globals.css's --background / --muted-foreground per theme -
 *  WebGPU needs raw RGBA floats, not CSS custom properties. */
function getViewerColors(theme: "light" | "dark"): {
    clearColor: [number, number, number, number];
    lineColor: [number, number, number, number];
} {
    return theme === "dark"
        ? { clearColor: hexToRgba("#1d1f25"), lineColor: hexToRgba("#98a1bc") }
        : {
              clearColor: hexToRgba("#ffffff"),
              lineColor: hexToRgba("#8087a8")
          };
}

const CLICK_DRAG_THRESHOLD_PX = 4;

async function downloadWithProgress(
    url: string,
    signal: AbortSignal | undefined,
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

/** A user-picked isolation always wins over IfcViewer's own visible-files
 *  union - safe since anything selectable is already within it. */
function getEffectiveIsolatedIds(
    viewer: IfcViewer,
    userIsolatedIds: Set<number> | null
): Set<number> | undefined {
    return userIsolatedIds ?? viewer.getIsolatedIds() ?? undefined;
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
    const { projectInfo, visibleIfcFiles } = useDigitalTwin();
    const { theme } = useTheme();
    const themeColorsRef = useRef(getViewerColors(theme));
    const mountRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<IfcViewer | null>(null);
    const loadAbortControllerRef = useRef<AbortController | null>(null);
    const selectionRef = useRef<{ selectedExpressId: number | null }>({
        selectedExpressId: null
    });
    const visibilityRef = useRef<{
        hiddenIds: Set<number>;
        userIsolatedIds: Set<number> | null;
    }>({ hiddenIds: new Set(), userIsolatedIds: null });
    // Queue of not-yet-loaded files waiting their turn; loads run one at a
    // time (GeometryProcessor's WASM worker pool is shared per viewer, and
    // concurrent processAdaptive calls on it aren't known to be safe).
    const pendingQueueRef = useRef<SelectedIfcFile[]>([]);
    const queueRunningRef = useRef(false);
    const desiredFileIdsRef = useRef<Set<string>>(new Set());

    const [loadState, setLoadState] = useState<LoadState | null>(null);
    const [loadingFile, setLoadingFile] = useState<SelectedIfcFile | null>(
        null
    );
    const [selectedElement, setSelectedElement] =
        useState<SelectedElement | null>(null);
    const [hiddenCount, setHiddenCount] = useState(0);
    const [isIsolating, setIsIsolating] = useState(false);
    const [sunPanelOpen, setSunPanelOpen] = useState(false);
    const [siteLocation, setSiteLocation] = useState<SiteLocation | null>(
        null
    );

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) {
            return;
        }

        let disposed = false;
        loadAbortControllerRef.current = new AbortController();

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
            const hit = await viewer
                .getRenderer()
                .pick(event.clientX - rect.left, event.clientY - rect.top, {
                    hiddenIds:
                        visibilityRef.current.hiddenIds.size > 0
                            ? visibilityRef.current.hiddenIds
                            : undefined,
                    isolatedIds: getEffectiveIsolatedIds(
                        viewer,
                        visibilityRef.current.userIsolatedIds
                    )
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
                clearColor: themeColorsRef.current.clearColor,
                hiddenIds:
                    visibilityRef.current.hiddenIds.size > 0
                        ? visibilityRef.current.hiddenIds
                        : undefined,
                isolatedIds: getEffectiveIsolatedIds(
                    viewer,
                    visibilityRef.current.userIsolatedIds
                ),
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
                viewer
                    .getRenderer()
                    .setOverlayLineColor(themeColorsRef.current.lineColor);
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
            loadAbortControllerRef.current?.abort();
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

    useEffect(() => {
        const colors = getViewerColors(theme);
        themeColorsRef.current = colors;
        viewerRef.current?.getRenderer().setOverlayLineColor(colors.lineColor);
    }, [theme]);

    // Reconciles the desired visible-file set against the viewer: already-
    // loaded files show instantly, not-yet-loaded ones are queued and
    // downloaded/parsed one at a time.
    useEffect(() => {
        setSelectedElement(null);
        selectionRef.current.selectedExpressId = null;

        const viewer = viewerRef.current;
        if (!viewer) {
            return;
        }

        desiredFileIdsRef.current = new Set(
            visibleIfcFiles.map((f) => f.fileId)
        );
        viewer.setVisibleFiles(desiredFileIdsRef.current);
        setSiteLocation(viewer.getSiteLocation());

        for (const file of visibleIfcFiles) {
            const alreadyQueued = pendingQueueRef.current.some(
                (f) => f.fileId === file.fileId
            );
            if (!viewer.isLoaded(file.fileId) && !alreadyQueued) {
                pendingQueueRef.current.push(file);
            }
        }

        if (!queueRunningRef.current) {
            void processQueue();
        }

        async function loadOneFile(file: SelectedIfcFile): Promise<void> {
            setLoadingFile(file);
            setLoadState({ status: "connecting" });
            viewer!.onProgress = (progress) => {
                setLoadState({
                    status: "processing",
                    processed: progress.processed
                });
            };
            try {
                const signal = loadAbortControllerRef.current?.signal;
                const objectKey = `${projectInfo.id}/${file.discipline}/${file.fileId}`;
                const buffer = await downloadWithProgress(
                    buildProjectFileUrl(objectKey),
                    signal,
                    (loadedBytes, totalBytes) => {
                        setLoadState({
                            status: "downloading",
                            processed: loadedBytes,
                            total: totalBytes
                        });
                    }
                );
                setLoadState({ status: "processing", processed: 0 });
                await viewer!.loadFile(file.fileId, buffer, signal);
                viewer!.setVisibleFiles(desiredFileIdsRef.current);
                setSiteLocation(viewer!.getSiteLocation());
                setLoadState(null);
            } catch (error) {
                if (loadAbortControllerRef.current?.signal.aborted) {
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
            } finally {
                viewer!.onProgress = undefined;
                setLoadingFile(null);
            }
        }

        async function processQueue(): Promise<void> {
            queueRunningRef.current = true;
            while (pendingQueueRef.current.length > 0) {
                const next = pendingQueueRef.current.shift()!;
                if (
                    viewer!.isLoaded(next.fileId) ||
                    !desiredFileIdsRef.current.has(next.fileId)
                ) {
                    continue;
                }
                await loadOneFile(next);
            }
            queueRunningRef.current = false;
        }
    }, [visibleIfcFiles, projectInfo.id]);

    function handleDismissError() {
        setLoadState(null);
    }

    function handleHideSelected() {
        const expressId = selectionRef.current.selectedExpressId;
        if (expressId === null) {
            return;
        }
        visibilityRef.current.hiddenIds.add(expressId);
        setHiddenCount(visibilityRef.current.hiddenIds.size);
        selectionRef.current.selectedExpressId = null;
        setSelectedElement(null);
    }

    function handleIsolateSelected() {
        const expressId = selectionRef.current.selectedExpressId;
        if (expressId === null) {
            return;
        }
        visibilityRef.current.userIsolatedIds = new Set([expressId]);
        setIsIsolating(true);
    }

    function handleShowAll() {
        visibilityRef.current.hiddenIds.clear();
        visibilityRef.current.userIsolatedIds = null;
        setHiddenCount(0);
        setIsIsolating(false);
    }

    function handlePresetView(
        view: "top" | "bottom" | "front" | "back" | "left" | "right"
    ) {
        const renderer = viewerRef.current?.getRenderer();
        if (!renderer) {
            return;
        }
        renderer
            .getCamera()
            .setPresetView(view, renderer.getModelBounds() ?? undefined);
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
                    <>
                        <span className="normal-case tracking-normal text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
                            {selectedElement.ifcType ?? "Element"} #
                            {selectedElement.expressId}
                        </span>
                        <button
                            onClick={handleHideSelected}
                            className="shrink-0 rounded p-1 hover:cursor-pointer hover:text-primary hover:bg-primary/10"
                            aria-label="Hide selected element"
                            title="Hide selected element"
                        >
                            <EyeOff className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={handleIsolateSelected}
                            className="shrink-0 rounded p-1 hover:cursor-pointer hover:text-primary hover:bg-primary/10"
                            aria-label="Isolate selected element"
                            title="Isolate selected element"
                        >
                            <Focus className="h-3.5 w-3.5" />
                        </button>
                    </>
                )}
                {(hiddenCount > 0 || isIsolating) && (
                    <button
                        onClick={handleShowAll}
                        className="shrink-0 flex items-center gap-1 rounded p-1 normal-case tracking-normal text-[10px] hover:cursor-pointer hover:text-primary hover:bg-primary/10"
                        aria-label="Show all"
                        title="Clear hide/isolate"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Show all
                        {hiddenCount > 0 && ` (${hiddenCount})`}
                    </button>
                )}
            </div>

            <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1">
                <button
                    onClick={onToggleMaximize}
                    className={cn(
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

                <div className="grid grid-cols-3 gap-0.5 rounded-md border border-border/60 bg-surface/50 p-1">
                    {(
                        [
                            ["top", "Top"],
                            ["front", "Front"],
                            ["right", "Right"],
                            ["bottom", "Bottom"],
                            ["back", "Back"],
                            ["left", "Left"]
                        ] as const
                    ).map(([view, label]) => (
                        <button
                            key={view}
                            onClick={() => handlePresetView(view)}
                            className="h-6 w-9 rounded text-[9px] font-mono uppercase text-surface-foreground hover:cursor-pointer hover:text-primary hover:bg-primary/10"
                            aria-label={`${label} view`}
                            title={`${label} view`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <button
                        onClick={() => {
                            setSunPanelOpen((open) => {
                                const next = !open;
                                if (!next) {
                                    viewerRef.current?.hideSunPath();
                                }
                                return next;
                            });
                        }}
                        className={cn(
                            "h-7 w-7 flex items-center justify-center rounded",
                            "border border-border/60",
                            "hover:cursor-pointer hover:bg-primary/10",
                            sunPanelOpen
                                ? "bg-primary/20 text-primary"
                                : "bg-surface/50 text-surface-foreground hover:text-primary"
                        )}
                        aria-label={
                            sunPanelOpen
                                ? "Close sun path settings"
                                : "Open sun path settings"
                        }
                        aria-pressed={sunPanelOpen}
                        aria-expanded={sunPanelOpen}
                        title="Sun path"
                    >
                        <Sun className="h-3.5 w-3.5" />
                    </button>

                    {sunPanelOpen && (
                        <SunPanel
                            siteLocation={siteLocation}
                            onClose={() => {
                                setSunPanelOpen(false);
                                viewerRef.current?.hideSunPath();
                            }}
                            onSubmit={(latLon, dateTime) => {
                                viewerRef.current?.showSunPathAt(
                                    latLon,
                                    dateTime
                                );
                            }}
                        />
                    )}
                </div>
            </div>

            <div ref={mountRef} className="h-full w-full" />

            {visibleIfcFiles.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Select an IFC file from the sidebar to view it here.
                </div>
            )}

            <IfcLoadStatusBar
                loadState={loadState}
                fileName={loadingFile?.fileName}
                onDismissError={handleDismissError}
            />
        </div>
    );
}

export { IfcViewerPane };
