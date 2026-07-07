import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { LeftSidebar } from "components/feature/twin/LeftSidebar";
import { TopNav } from "components/feature/twin/TopNav/index";
import { DigitalTwinProvider, useDigitalTwin } from "hooks/useDigitalTwin";
import { api } from "utils/trpc";

// Pre-selects the project named in the /digital-twin/:projectId route, once
// it shows up in the caller's visible-projects list (public or a member of).
function ProjectRouteSync() {
    const { projectId } = useParams<{ projectId?: string }>();
    const { projectInfo, setProjectInfo } = useDigitalTwin();
    const { data: projects } = api.digitalTwin.getProjects.useQuery();

    useEffect(() => {
        if (!projectId || projectInfo?.id === projectId) {
            return;
        }
        const project = projects?.find((p) => p.id === projectId);
        if (project) {
            setProjectInfo({ id: project.id, name: project.name });
        }
    }, [projectId, projectInfo?.id, projects, setProjectInfo]);

    return null;
}

const DigitalTwin = () => {
    const liveMode = true; // TODO: Determine live mode based on environment or user settings

    return (
        <DigitalTwinProvider>
            <ProjectRouteSync />
            <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
                <h1 className="sr-only">MD2MV — Digital Twin Command Center</h1>

                <TopNav liveMode={liveMode} />

                <div className="flex-1 flex min-h-0">
                    <LeftSidebar />

                    {/* <main className="flex-1 flex flex-col min-w-0 min-h-0">
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
                                        <section
                                            className={cn(
                                                "h-full min-w-0",
                                                viewerHidden ? "hidden" : ""
                                            )}
                                            aria-label="3D Viewer"
                                            aria-hidden={viewerHidden}
                                        >
                                            <ViewerPane
                                                selectedId={selectedId}
                                                onSelect={setSelectedId}
                                                liveMode={liveMode}
                                                loadedIfcByDiscipline={
                                                    loadedIfcByDiscipline
                                                }
                                                ifcVisibilityByFile={
                                                    ifcVisibilityByFile
                                                }
                                                semanticTriples={
                                                    semanticTriples
                                                }
                                                selectedFloorKeys={
                                                    selectedFloorKeys
                                                }
                                                setSelectedFloorKeys={
                                                    setSelectedFloorKeys
                                                }
                                                getIfcSelectionId={
                                                    getIfcSelectionId
                                                }
                                                maximized={
                                                    maximized === "viewer"
                                                }
                                                onToggleMaximize={() =>
                                                    setMaximized((m) =>
                                                        m === "viewer"
                                                            ? null
                                                            : "viewer"
                                                    )
                                                }
                                                onComponentInfoChange={
                                                    setSelectedComponentInfo
                                                }
                                                onFloorOptionsChange={
                                                    setFloorOptions
                                                }
                                            />
                                        </section>
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
                                                selectedId={selectedId}
                                                onSelect={setSelectedId}
                                                graphDataOverride={
                                                    semanticGraphResult
                                                }
                                                semanticTriples={
                                                    semanticTriples
                                                }
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
                                <BottomPanel
                                    collapsed={bottomCollapsed}
                                    onToggle={() => {
                                        if (semanticMaximized) {
                                            setMaximized(null);
                                        }
                                        setBottomCollapsed((v) => !v);
                                    }}
                                    maximized={semanticMaximized}
                                    onToggleMaximize={() =>
                                        setMaximized((m) =>
                                            m === "semantic" ? null : "semantic"
                                        )
                                    }
                                    onGraphResultChange={(graph, triples) => {
                                        setSemanticGraphResult(graph);
                                        if (triples) {
                                            setSemanticTriples(triples);
                                        }
                                    }}
                                    selectedNodeId={selectedId}
                                />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </div>
                </main> */}
                </div>
            </div>
        </DigitalTwinProvider>
    );
};

export { DigitalTwin };
