import { useRef, type ReactNode } from "react";
import {
    AlertTriangle,
    DatabaseX,
    GitBranch,
    Loader2,
    Maximize2,
    Minimize2
} from "lucide-react";
import { GraphCanvas } from "./GraphCanvas";
import { GraphLegend } from "./GraphLegend";
import { SelectionPanel } from "./SelectionPanel";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import { useDigitalTwin } from "hooks/useDigitalTwin";

// Shared chrome (border, header badge) so the loading/error placeholders
// read as the same panel rather than an unrelated centered-text block.
function GraphPaneHeader() {
    return (
        <div
            className={cn(
                "absolute top-2 left-3 z-20",
                "flex items-center gap-2 px-3 py-2",
                "rounded-md bg-surface text-surface-foreground",
                "border border-border/60"
            )}
        >
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Relationship Graph
            </span>
        </div>
    );
}

function GraphPaneShell({ children }: { children: ReactNode }) {
    return (
        <div className="relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-card/40">
            <GraphPaneHeader />
            <div className="flex h-full w-full items-center justify-center">
                {children}
            </div>
        </div>
    );
}

function GraphPane({
    maximized = false,
    onToggleMaximize
}: {
    maximized?: boolean;
    onToggleMaximize?: () => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { projectInfo, focusId } = useDigitalTwin();

    // Just for testing, until we have a backend call to get the graph data.
    // TODO: fill in the discipline/fileId this focus node's TTL was synced
    // under (see the Fuseki tree sidebar / project files list) - the graph
    // is now scoped to a single named graph, same as getGraphTree.
    const discipline = "disc-ark";
    const fileId = "f9767f10-c0c4-46bc-9d2d-b608492dfcec";

    const {
        data: graphData,
        isLoading,
        isError,
        error
    } = api.digitalTwin.getRelationshipGraph.useQuery({
        projectId: projectInfo.id,
        discipline: discipline,
        fileId: fileId,
        focusId: focusId
    });

    if (isLoading) {
        return (
            <GraphPaneShell>
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Loading graph...</span>
                </div>
            </GraphPaneShell>
        );
    }

    if (isError || !graphData) {
        const isNotFound = error?.data?.code === "NOT_FOUND";

        return (
            <GraphPaneShell>
                <div
                    className={cn(
                        "flex flex-col items-center gap-2 px-4 text-center",
                        isNotFound
                            ? "text-muted-foreground"
                            : "text-destructive"
                    )}
                >
                    {isNotFound ? (
                        <DatabaseX className="h-5 w-5" />
                    ) : (
                        <AlertTriangle className="h-5 w-5" />
                    )}
                    <span className="text-xs">
                        {isNotFound
                            ? error.message
                            : "Error loading graph data."}
                    </span>
                </div>
            </GraphPaneShell>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-card/40"
        >
            <GraphPaneHeader />

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

            <GraphCanvas graphData={graphData} centerNodeId={focusId} />

            <GraphLegend nodes={graphData.nodes} />

            <SelectionPanel
                containerRef={containerRef}
                nodes={graphData.nodes}
            />
        </div>
    );
}

export { GraphPane };
