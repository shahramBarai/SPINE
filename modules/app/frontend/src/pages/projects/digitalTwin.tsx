import { useEffect, useRef, useState } from "react";
import { type ImperativePanelHandle } from "react-resizable-panels";
import { LeftSidebar } from "components/feature/twin/LeftSidebar";
import { TopNav } from "components/feature/twin/TopNav/index";
import { IfcViewerPane } from "components/feature/twin/IfcViewerPane";
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

type MaximizedZone = "viewer" | "semantic" | null;

interface DigitalTwinPageProps {
    project: { id: string; name: string };
}

function DigitalTwinPageContent({ project }: DigitalTwinPageProps) {
    return (
        <DigitalTwinProvider
            key={project.id}
            projectInfo={{ id: project.id, name: project.name }}
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
    const viewerMaximized = maximized === "viewer";
    const viewerHidden = semanticMaximized;

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
                                <IfcViewerPane
                                    hidden={viewerHidden}
                                    maximized={viewerMaximized}
                                    onToggleMaximize={() =>
                                        setMaximized((m) =>
                                            m === "viewer" ? null : "viewer"
                                        )
                                    }
                                />
                            </ResizablePanel>

                            <ResizableHandle
                                withHandle
                                className={cn(
                                    semanticMaximized || viewerMaximized
                                        ? "hidden"
                                        : ""
                                )}
                            />

                            <ResizablePanel
                                ref={semanticPanelRef}
                                defaultSize={32}
                                minSize={10}
                                collapsible
                                collapsedSize={6}
                                className={cn(
                                    "min-h-0",
                                    viewerMaximized ? "hidden" : ""
                                )}
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
