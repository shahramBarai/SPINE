import { Loader2, AlertTriangle, X } from "lucide-react";

type LoadState =
    | { status: "connecting" }
    | { status: "downloading"; processed: number; total: number | null }
    | { status: "processing"; processed: number }
    | { status: "error"; message: string };

/**
 * Bottom status bar for IfcViewerPane's model loading. Every non-error phase
 * gets a label describing what's actually happening right now (never just a
 * bare spinner) plus a bar: a real fill while downloading with a known
 * Content-Length, or an indeterminate pulse everywhere else (connecting, a
 * Content-Length-less download, and the whole processing phase) - honest
 * about not knowing how far along those are, rather than estimating.
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
    if (!loadState) {
        return null;
    }

    if (loadState.status === "error") {
        return (
            <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-md border border-border/60 bg-surface/90 px-3 py-2 text-surface-foreground">
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
            </div>
        );
    }

    // Only "downloading" with a known Content-Length ever has a real,
    // known-total percentage. Every other in-progress state gets an
    // indeterminate bar further down instead.
    const downloadPercent =
        loadState.status === "downloading" &&
        loadState.total !== null &&
        loadState.total > 0
            ? Math.min(
                  100,
                  Math.round((loadState.processed / loadState.total) * 100)
              )
            : null;

    const label =
        loadState.status === "connecting"
            ? "connecting…"
            : loadState.status === "downloading"
              ? downloadPercent !== null
                  ? `Downloading — ${downloadPercent}%`
                  : "Downloading…"
              : loadState.processed > 0
                ? `Extracting geometry — ${loadState.processed.toLocaleString()} meshes`
                : "Extracting geometry…";

    return (
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 rounded-md border border-border/60 bg-surface/90 px-3 py-2 text-surface-foreground">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
                {fileName} — {label}
            </span>

            {downloadPercent !== null && (
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/60">
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${downloadPercent}%` }}
                    />
                </div>
            )}
        </div>
    );
}

export { IfcLoadStatusBar, type LoadState };
