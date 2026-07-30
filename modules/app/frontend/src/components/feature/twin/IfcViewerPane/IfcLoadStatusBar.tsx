import { useRef } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { cn } from "utils/index";

type LoadState =
    | { status: "connecting" }
    // "loading": receiving data from the backend (batches or cache-hit
    // chunks). "decoding": turning already-received cache-hit geometry into
    // meshes - see IfcViewerPane's model-loading effect for why only the
    // cache-hit path gets its own visible phase, not live-parse batches.
    | { status: "loading"; processed: number; total: number }
    | { status: "decoding"; processed: number; total: number }
    | { status: "error"; message: string };

/**
 * Bottom status bar for IfcViewerPane's model loading - a spinner/filename
 * while connecting, a progress bar while loading/decoding, or a dismissible
 * error. One bar element is reused across the "loading" and "decoding"
 * phases (color transitions between them) rather than swapping in a
 * different element, so the transition reads as one continuous fill rather
 * than one bar closing and another opening.
 */
function IfcLoadStatusBar({
    loadState,
    fileName,
    onDismissError
}: {
    loadState: LoadState | null;
    fileName: string | undefined;
    onDismissError: () => void;
}) {
    // "loading" ends at 100% and "decoding" starts back at 0% - animating
    // that transition makes the bar visibly shrink back to 0 before
    // growing again, reading as a glitch (especially when decoding
    // finishes faster than loading did). Disabling the transition only for
    // the render where the phase itself changes gives an instant jump at
    // the boundary while keeping smooth fills within each phase.
    const prevStatusRef = useRef<LoadState["status"] | undefined>(undefined);
    const phaseJustChanged = loadState?.status !== prevStatusRef.current;
    prevStatusRef.current = loadState?.status;

    if (!loadState) {
        return null;
    }

    return (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-md border border-border/60 bg-surface/90 px-3 py-2 text-surface-foreground">
            {loadState.status === "error" ? (
                <>
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-danger" />
                    <span className="flex-1 truncate text-[10px] font-mono text-danger">
                        {loadState.message}
                    </span>
                    <button
                        type="button"
                        onClick={onDismissError}
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
                        {fileName}
                        {(loadState.status === "loading" ||
                            loadState.status === "decoding") &&
                            loadState.total > 0 &&
                            ` — ${loadState.status === "decoding" ? "rendering " : ""}${Math.min(
                                100,
                                Math.round(
                                    (loadState.processed / loadState.total) *
                                        100
                                )
                            )}%`}
                    </span>
                    {(loadState.status === "loading" ||
                        loadState.status === "decoding") &&
                        loadState.total > 0 && (
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                                <div
                                    className={cn(
                                        "h-full rounded-full",
                                        !phaseJustChanged &&
                                            "transition-[width,background-color] duration-300 ease-out",
                                        loadState.status === "decoding"
                                            ? "bg-success"
                                            : "bg-primary"
                                    )}
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
    );
}

export { IfcLoadStatusBar, type LoadState };
