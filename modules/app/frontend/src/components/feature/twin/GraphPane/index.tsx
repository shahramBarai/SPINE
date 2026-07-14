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
import { type GraphData } from "./types/graph";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import { useDigitalTwin } from "hooks/useDigitalTwin";

// Backend call is disabled for now - working against a stand-in for the
// shape `getRelationshipGraph` returns (GraphNode/GraphEdge) until the
// canvas/interaction logic is solid.
const MOCK_GRAPH_DATA: GraphData = {
    nodes: [
        { id: "site_1", label: "Myllypuro Campus", type: "Site" },
        { id: "building_1", label: "Building A", type: "Building" },
        { id: "storey_1", label: "Floor 1", type: "Storey" },
        { id: "space_1", label: "Room 101", type: "Space" },
        { id: "space_2", label: "Room 102", type: "Space" },
        { id: "sensor_1", label: "Temp Sensor 1", type: "Sensor" }
    ],
    edges: [
        { from_id: "site_1", to_id: "building_1", label: "hasBuilding" },
        { from_id: "building_1", to_id: "storey_1", label: "hasStorey" },
        { from_id: "storey_1", to_id: "space_1", label: "hasSpace" },
        { from_id: "storey_1", to_id: "space_2", label: "hasSpace" },
        { from_id: "space_1", to_id: "sensor_1", label: "hasSensor" }
    ]
};

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
    const { focusId } = useDigitalTwin();

    // Just for testing, until we have a backend call to get the graph data.
    // TODO: fill in the discipline/fileId this focus node's TTL was synced
    // under (see the Fuseki tree sidebar / project files list) - the graph
    // is now scoped to a single named graph, same as getGraphTree.
    const projectId = "cmrj97fa70001mrvg2cfblzmw";
    const discipline = "disc-ark";
    const fileId = "eb66529f-5f25-463a-984e-92112a30b6fa";
    const DEFAULT_FOCUS_ID = "building_28cb49f1-9b69-4870-aca3-d3f3628a7f64";

    // focusId starts null until the user explicitly confirms one (see
    // SelectionPanel's "set as focus" button) - fall back to the test
    // default until then, so this keeps working standalone.
    const effectiveFocusId = focusId ?? DEFAULT_FOCUS_ID;

    const {
        data: graphData,
        isLoading,
        isError,
        error
    } = api.digitalTwin.getRelationshipGraph.useQuery({
        projectId: projectId,
        discipline: discipline,
        fileId: fileId,
        focusId: effectiveFocusId
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

            <GraphCanvas
                graphData={graphData}
                centerNodeId={effectiveFocusId}
            />

            <GraphLegend nodes={graphData.nodes} />

            <SelectionPanel
                containerRef={containerRef}
                nodes={graphData.nodes}
            />
        </div>
    );
}

export { GraphPane };
