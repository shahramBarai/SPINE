import { useEffect, useRef, useState } from "react";
import { type ImperativePanelHandle } from "react-resizable-panels";
import { LeftSidebar } from "components/feature/twin/LeftSidebar";
import { TopNav } from "components/feature/twin/TopNav/index";
import { IfcViewerPane } from "components/feature/twin/IfcViewerPane";
import { GraphPane } from "components/feature/twin/GraphPane";
import { SemanticSearchPanel } from "components/feature/twin/SemanticSearchPanel";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "components/basics/resizable";
import { DigitalTwinProvider } from "hooks/useDigitalTwin";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { pageGuard } from "utils/pageGuard";

type MaximizedZone = "viewer" | "graph" | "semantic" | null;

interface DigitalTwinPageProps {
    project: { id: string; name: string; rootId: string };
}

function DigitalTwinPageContent({ project }: DigitalTwinPageProps) {
    return (
        <DigitalTwinProvider
            key={project.id}
            projectInfo={{ id: project.id, name: project.name }}
            focusId={project.rootId}
        >
            <DigitalTwinLayout />
        </DigitalTwinProvider>
    );
}

const DigitalTwinLayout = () => {
    const liveMode = true; // TODO: Determine live mode based on environment or user settings

    const [maximized, setMaximized] = useState<MaximizedZone>(null);
    const [bottomCollapsed, setBottomCollapsed] = useState(false);
    const semanticPanelRef = useRef<ImperativePanelHandle | null>(null);

    const semanticMaximized = maximized === "semantic";
    const viewerHidden = maximized === "graph" || semanticMaximized;
    const graphHidden = maximized === "viewer" || semanticMaximized;

    useEffect(() => {
        const panel = semanticPanelRef.current;
        if (!panel) {
            return;
        }

        if (bottomCollapsed) {
            panel.collapse();
            return;
        }

        panel.expand();
    }, [bottomCollapsed]);

    return (
        <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
            <h1 className="sr-only">MD2MV — Digital Twin Command Center</h1>

            <TopNav liveMode={liveMode} />

            <div className="flex-1 flex min-h-0">
                <LeftSidebar />

                <main className="flex-1 flex flex-col min-w-0 min-h-0">
                    <div className="flex-1 min-h-0 p-2">
                        <ResizablePanelGroup
                            direction="vertical"
                            className="min-h-0 gap-2"
                        >
                            <ResizablePanel
                                defaultSize={68}
                                minSize={25}
                                className={cn(
                                    "min-h-0",
                                    semanticMaximized ? "hidden" : ""
                                )}
                            >
                                <ResizablePanelGroup
                                    direction="horizontal"
                                    className="min-h-0 gap-2"
                                >
                                    <ResizablePanel
                                        defaultSize={58}
                                        minSize={25}
                                        className={cn(
                                            "min-w-0",
                                            maximized === "graph"
                                                ? "hidden"
                                                : ""
                                        )}
                                    >
                                        <IfcViewerPane
                                            hidden={viewerHidden}
                                            maximized={maximized === "viewer"}
                                            onToggleMaximize={() =>
                                                setMaximized((m) =>
                                                    m === "viewer"
                                                        ? null
                                                        : "viewer"
                                                )
                                            }
                                        />
                                    </ResizablePanel>

                                    <ResizableHandle
                                        withHandle
                                        className={cn(
                                            maximized === "viewer" ||
                                                maximized === "graph"
                                                ? "hidden"
                                                : ""
                                        )}
                                    />

                                    <ResizablePanel
                                        defaultSize={42}
                                        minSize={25}
                                        className={cn(
                                            "min-w-0",
                                            maximized === "viewer"
                                                ? "hidden"
                                                : ""
                                        )}
                                    >
                                        <section
                                            className={cn(
                                                "h-full min-w-0",
                                                graphHidden ? "hidden" : ""
                                            )}
                                            aria-label="Relationship Graph"
                                            aria-hidden={graphHidden}
                                        >
                                            <GraphPane
                                                maximized={
                                                    maximized === "graph"
                                                }
                                                onToggleMaximize={() =>
                                                    setMaximized((m) =>
                                                        m === "graph"
                                                            ? null
                                                            : "graph"
                                                    )
                                                }
                                            />
                                        </section>
                                    </ResizablePanel>
                                </ResizablePanelGroup>
                            </ResizablePanel>

                            <ResizableHandle
                                withHandle
                                className={cn(
                                    semanticMaximized ? "hidden" : ""
                                )}
                            />

                            <ResizablePanel
                                ref={semanticPanelRef}
                                defaultSize={32}
                                minSize={10}
                                collapsible
                                collapsedSize={6}
                                className="min-h-0"
                            >
                                <SemanticSearchPanel
                                    maximized={semanticMaximized}
                                    onToggleMaximize={() =>
                                        setMaximized((m) =>
                                            m === "semantic" ? null : "semantic"
                                        )
                                    }
                                    collapsed={bottomCollapsed}
                                    onToggleCollapsed={() => {
                                        if (semanticMaximized) {
                                            setMaximized(null);
                                        }
                                        setBottomCollapsed((v) => !v);
                                    }}
                                />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </div>
                </main>
            </div>
        </div>
    );
};

const DigitalTwin = pageGuard(DigitalTwinPageContent, {
    params: ["projectId"],
    handler: ({ projectId }) => {
        const {
            data: project,
            isLoading,
            error
        } = api.digitalTwin.getProject.useQuery({ projectId });

        return {
            isLoading,
            error,
            data: project ? { project } : undefined,
            loadingLabel: "Loading project...",
            fullScreen: true
        };
    }
});

export { DigitalTwin };
