import { useEffect, useState } from "react";
import { TopNav } from "@/components/twin/TopNav";
import { LeftSidebar } from "@/components/twin/LeftSidebar";
import { ViewerPane } from "@/components/twin/ViewerPane";
import { GraphPane } from "@/components/twin/GraphPane";
import { BottomPanel } from "@/components/twin/BottomPanel";
import { useApiHealthQuery, useProjectTreeQuery } from "@/hooks/use-twin-data";
import { type GraphData } from "@/lib/twin-api";
import { type IfcNode, type Triple } from "@/lib/twin-data";
import { cn } from "@/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

type LoadedIfcFile = File;
type ProjectName = "Metropolia Myllypuro Campus" | "SmartLab";

const getIfcFileKey = (file: LoadedIfcFile): string => `${file.name}:${file.size}:${file.lastModified}`;

const getFirstNodeId = (nodes: IfcNode[]): string | null => {
  for (const node of nodes) {
    if (node.id) return node.id;
    if (node.children?.length) {
      const child = getFirstNodeId(node.children);
      if (child) return child;
    }
  }
  return null;
};

const Index = () => {
  const { data: projectTreeData } = useProjectTreeQuery();
  const apiHealthQuery = useApiHealthQuery();
  const [selectedProject, setSelectedProject] = useState<ProjectName>("Metropolia Myllypuro Campus");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedIfcByProject, setLoadedIfcByProject] = useState<Record<ProjectName, Record<string, LoadedIfcFile[]>>>(
    {
      "Metropolia Myllypuro Campus": {},
      SmartLab: {},
    }
  );
  const [ifcVisibilityByProject, setIfcVisibilityByProject] = useState<Record<ProjectName, Record<string, boolean>>>(
    {
      "Metropolia Myllypuro Campus": {},
      SmartLab: {},
    }
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [semanticGraphResult, setSemanticGraphResult] = useState<GraphData | null>(null);
  const [semanticTriples, setSemanticTriples] = useState<Triple[]>([]);
  const [layers, setLayers] = useState({ geometry: true, semantic: true, heatmap: false });
  const [maximized, setMaximized] = useState<"viewer" | "graph" | "semantic" | null>(null);

  const loadedIfcByDiscipline = loadedIfcByProject[selectedProject];
  const ifcVisibilityByFile = ifcVisibilityByProject[selectedProject];
  const liveMode = apiHealthQuery.data?.timescaledb.connected ?? false;
  const semanticMaximized = maximized === "semantic";
  const viewerHidden = maximized === "graph" || semanticMaximized;
  const graphHidden = maximized === "viewer" || semanticMaximized;

  useEffect(() => {
    setSelectedId(null);
    setSemanticGraphResult(null);
    setSemanticTriples([]);
  }, [selectedProject]);



  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
      <h1 className="sr-only">MD2MV — Digital Twin Command Center</h1>

      <TopNav
        liveMode={liveMode}
        project={selectedProject}
        onProjectChange={(project) => setSelectedProject(project as ProjectName)}
      />

      <div className="flex-1 flex min-h-0">
        <LeftSidebar
          key={selectedProject}
          projectName={selectedProject}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loadedIfcByDiscipline={loadedIfcByDiscipline}
          ifcVisibilityByFile={ifcVisibilityByFile}
          onIfcFilesLoaded={(disciplineId, files) => {
            setLoadedIfcByProject((prev) => {
              const existingFiles = prev[selectedProject][disciplineId] ?? [];
              return {
                ...prev,
                [selectedProject]: {
                  ...prev[selectedProject],
                  [disciplineId]: [...existingFiles, ...files],
                },
              };
            });
            setIfcVisibilityByProject((prev) => {
              const next = { ...prev };
              const projectVisibility = { ...next[selectedProject] };
              for (const file of files) {
                projectVisibility[`${disciplineId}:${getIfcFileKey(file)}`] = true;
              }
              next[selectedProject] = projectVisibility;
              return next;
            });
          }}
          onIfcVisibilityChange={(disciplineId, fileKey, visible) => {
            setIfcVisibilityByProject((prev) => ({
              ...prev,
              [selectedProject]: {
                ...prev[selectedProject],
                [`${disciplineId}:${fileKey}`]: visible,
              },
            }));
          }}
          onIfcFileRemoved={(disciplineId, fileKey) => {
            setLoadedIfcByProject((prev) => ({
              ...prev,
              [selectedProject]: {
                ...prev[selectedProject],
                [disciplineId]: (prev[selectedProject][disciplineId] ?? []).filter(
                  (file) => getIfcFileKey(file) !== fileKey
                ),
              },
            }));

            setIfcVisibilityByProject((prev) => {
              const next = { ...prev };
              const projectVisibility = { ...next[selectedProject] };
              delete projectVisibility[`${disciplineId}:${fileKey}`];
              next[selectedProject] = projectVisibility;
              return next;
            });
          }}
          layers={layers}
          onToggleLayer={(k) => setLayers((p) => ({ ...p, [k]: !p[k] }))}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          liveMode={liveMode}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 p-2">
            <ResizablePanelGroup direction="vertical" className="min-h-0 gap-2">
              <ResizablePanel
                defaultSize={68}
                minSize={25}
                className={cn("min-h-0", semanticMaximized ? "hidden" : "")}
              >
                <ResizablePanelGroup direction="horizontal" className="min-h-0 gap-2">
                  <ResizablePanel
                    defaultSize={58}
                    minSize={25}
                    className={cn("min-w-0", maximized === "graph" ? "hidden" : "")}
                  >
                    <section
                      className={cn("h-full min-w-0", viewerHidden ? "hidden" : "")}
                      aria-label="3D Viewer"
                      aria-hidden={viewerHidden}
                    >
                      <ViewerPane
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        liveMode={liveMode}
                        loadedIfcByDiscipline={loadedIfcByDiscipline}
                        ifcVisibilityByFile={ifcVisibilityByFile}
                        semanticTriples={semanticTriples}
                        maximized={maximized === "viewer"}
                        onToggleMaximize={() => setMaximized((m) => (m === "viewer" ? null : "viewer"))}
                      />
                    </section>
                  </ResizablePanel>

                  <ResizableHandle withHandle className={cn(maximized === "viewer" || maximized === "graph" ? "hidden" : "")} />

                  <ResizablePanel
                    defaultSize={42}
                    minSize={25}
                    className={cn("min-w-0", maximized === "viewer" ? "hidden" : "")}
                  >
                    <section
                      className={cn("h-full min-w-0", graphHidden ? "hidden" : "")}
                      aria-label="Relationship Graph"
                      aria-hidden={graphHidden}
                    >
                      <GraphPane
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        graphDataOverride={semanticGraphResult}
                        semanticTriples={semanticTriples}
                        maximized={maximized === "graph"}
                        onToggleMaximize={() => setMaximized((m) => (m === "graph" ? null : "graph"))}
                      />
                    </section>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle withHandle className={cn(semanticMaximized ? "hidden" : "")} />

              <ResizablePanel defaultSize={32} minSize={10} className="min-h-0">
                <BottomPanel
                  collapsed={bottomCollapsed}
                  onToggle={() => setBottomCollapsed((v) => !v)}
                  maximized={semanticMaximized}
                  onToggleMaximize={() => setMaximized((m) => (m === "semantic" ? null : "semantic"))}
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
        </main>
      </div>
    </div>
  );
};

export default Index;
