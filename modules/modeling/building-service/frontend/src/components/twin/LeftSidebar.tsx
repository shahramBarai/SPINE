import { type ChangeEvent, useRef, useState } from "react";
import {
  Building2,
  ChevronRight,
  FolderOpen,
  FileCode2,
  CloudUpload,
  X,
  Radio,
  Eye,
  EyeOff,
  Thermometer,
  Wind,
  Users,
  Zap,
  Droplets,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { type Sensor } from "@/lib/twin-data";
import { useSensorsQuery } from "@/hooks/use-twin-data";
import { useToast } from "@/hooks/use-toast";
import { SelectedElementPanel } from "./SelectedElementPanel";

type LoadedIfcFile = File;
type LoadedTtlFile = File;

const getIfcFileKey = (file: LoadedIfcFile): string => `${file.name}:${file.size}:${file.lastModified}`;
const getTtlFileKey = (file: LoadedTtlFile): string => `${file.name}:${file.size}:${file.lastModified}`;
const makeIfcFileSelectionId = (disciplineId: string, fileKey: string): string =>
  `${disciplineId}:ifc-file:${encodeURIComponent(fileKey)}`;

const DISCIPLINES = [
  { id: "disc-ark", name: "ARK - Architectural" },
  { id: "disc-rak", name: "RAK - Structural" },
  { id: "disc-lvi", name: "LVI - HVAC & Plumbing" },
  { id: "disc-sahko", name: "SÄHKO - Electrical" },
] as const;

const LINKSET_NODE = {
  id: "disc-sahko:linkset",
  name: "Linkset",
} as const;

const SENSOR_NODE = {
  id: "sensor-node",
  name: "Sensor",
} as const;

const sensorIcon = {
  Temp: Thermometer,
  "CO₂": Wind,
  Occupancy: Users,
  Power: Zap,
  Humidity: Droplets,
};

const SectionHeader = ({ icon: Icon, label, count }: { icon: any; label: string; count?: number }) => (
  <div className="flex items-center gap-2 px-3 pt-4 pb-2">
    <Icon className="h-3.5 w-3.5 text-primary" />
    <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted-foreground">{label}</span>
    {typeof count === "number" && (
      <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
        {count}
      </span>
    )}
  </div>
);

const SensorRow = ({
  sensor,
  selected,
  onSelect,
}: {
  sensor: Sensor;
  selected: boolean;
  onSelect: () => void;
}) => {
  const Icon = sensorIcon[sensor.kind];
  const dotClass =
    sensor.status === "live"
      ? "bg-live shadow-live pulse-live"
      : sensor.status === "alert"
      ? "bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.6)]"
      : "bg-muted-foreground/40";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-accent/60 transition-colors group",
        selected && "bg-primary/10"
      )}
    >
      <span className={cn("relative h-2 w-2 rounded-full shrink-0", dotClass)} />
      <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
      <div className="flex-1 min-w-0 text-left">
        <div className="font-mono text-[11px] truncate">{sensor.name}</div>
        <div className="text-[10px] text-muted-foreground">{sensor.kind}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[11px] text-foreground">{sensor.value}</div>
        <div className="text-[9px] text-muted-foreground">{sensor.unit}</div>
      </div>
    </button>
  );
};

const SensorGroup = ({
  kind,
  icon: Icon,
  unit,
  items,
  selectedId,
  onSelect,
  visible,
  onToggleVisible,
}: {
  kind: string;
  icon: any;
  unit: string;
  items: Sensor[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) => {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  const values = items.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const hasAlert = items.some((s) => s.status === "alert");

  return (
    <div className={cn("border-b border-border/40 last:border-b-0", !visible && "opacity-50")}>
      <div className="w-full flex items-center hover:bg-accent/40 transition-colors">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2"
        >
          <ChevronRight
            className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")}
          />
          <Icon className={cn("h-3.5 w-3.5", hasAlert ? "text-destructive" : "text-primary")} />
          <span className="text-[11px] font-medium flex-1 text-left">{kind}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {min.toFixed(1)}–{max.toFixed(1)}
            <span className="ml-1 text-muted-foreground/70">{unit}</span>
          </span>
          <span className="text-[9px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
            {items.length}
          </span>
        </button>
        <button
          onClick={onToggleVisible}
          className="h-6 w-6 mr-2 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={visible ? "Hide group" : "Show group"}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>
      {open && (
        <div className="pb-1">
          {items.map((s) => (
            <SensorRow
              key={s.id}
              sensor={s}
              selected={selectedId === s.bound}
              onSelect={() => onSelect(s.bound)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const LeftSidebar = ({
  projectName,
  selectedId,
  onSelect,
  loadedIfcByDiscipline,
  ifcVisibilityByFile,
  onIfcFilesLoaded,
  onIfcFileRemoved,
  onIfcVisibilityChange,
  layers,
  onToggleLayer,
  collapsed,
  onToggleCollapsed,
  liveMode,
}: {
  projectName: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loadedIfcByDiscipline: Record<string, LoadedIfcFile[]>;
  ifcVisibilityByFile: Record<string, boolean>;
  onIfcFilesLoaded?: (disciplineId: string, files: File[]) => void;
  onIfcFileRemoved?: (disciplineId: string, fileKey: string) => void;
  onIfcVisibilityChange?: (disciplineId: string, fileKey: string, visible: boolean) => void;
  layers: { geometry: boolean; semantic: boolean; heatmap: boolean };
  onToggleLayer: (key: keyof typeof layers) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  liveMode: boolean;
}) => {
  const { data: sensorsData } = useSensorsQuery();
  const { toast } = useToast();
  const [hiddenGroups, setHiddenGroups] = useState<Record<string, boolean>>({});
  const [projectTreeExpanded, setProjectTreeExpanded] = useState(true);
  const [disciplineExpandedById, setDisciplineExpandedById] = useState<Record<string, boolean>>({});
  const [ifcExpandedByDiscipline, setIfcExpandedByDiscipline] = useState<Record<string, boolean>>({});
  const [ttlExpandedByNode, setTtlExpandedByNode] = useState<Record<string, boolean>>({});
  const [activeIfcDiscipline, setActiveIfcDiscipline] = useState<string | null>(null);
  const [activeTtlNode, setActiveTtlNode] = useState<string | null>(null);
  const [loadedTtlByNode, setLoadedTtlByNode] = useState<Record<string, LoadedTtlFile[]>>({});
  const ifcFileInputRef = useRef<HTMLInputElement>(null);
  const ttlFileInputRef = useRef<HTMLInputElement>(null);
  const toggleGroup = (k: string) => setHiddenGroups((p) => ({ ...p, [k]: !p[k] }));

  const lineId = (nodeId: string, line: "ifc" | "ttl") => `${nodeId}:${line}`;

  const openIfcFilePicker = (disciplineId: string) => {
    setActiveIfcDiscipline(disciplineId);
    ifcFileInputRef.current?.click();
  };

  const openTtlFilePicker = (nodeId: string) => {
    setActiveTtlNode(nodeId);
    ttlFileInputRef.current?.click();
  };

  const handleIfcFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeIfcDiscipline) return;
    const files = Array.from(event.target.files ?? []);
    const existingFiles = loadedIfcByDiscipline[activeIfcDiscipline] ?? [];
    const existingKeys = new Set(existingFiles.map(getIfcFileKey));
    const newFiles = files.filter((file) => !existingKeys.has(getIfcFileKey(file)));
    const duplicateFiles = files.filter((file) => existingKeys.has(getIfcFileKey(file)));

    if (newFiles.length > 0) {
      onIfcFilesLoaded?.(activeIfcDiscipline, newFiles);
    }

    setIfcExpandedByDiscipline((prev) => ({
      ...prev,
      [activeIfcDiscipline]: true,
    }));

    if (newFiles.length > 0) {
      toast({
        title: "IFC Files Added",
        description: `${newFiles.length} new file(s) added to ${DISCIPLINES.find((d) => d.id === activeIfcDiscipline)?.name ?? activeIfcDiscipline}.`,
      });
    }

    if (duplicateFiles.length > 0) {
      toast({
        title: "IFC Files Already Loaded",
        description: `${duplicateFiles.length} file(s) were already loaded and were skipped.`,
      });
    }

    event.target.value = "";
    setActiveIfcDiscipline(null);
  };

  const handleTtlFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!activeTtlNode) return;
    const files = Array.from(event.target.files ?? []);

    setLoadedTtlByNode((prev) => {
      const existingFiles = prev[activeTtlNode] ?? [];
      const existingKeys = new Set(existingFiles.map(getTtlFileKey));
      const newFiles = files.filter((file) => !existingKeys.has(getTtlFileKey(file)));
      const duplicateFiles = files.filter((file) => existingKeys.has(getTtlFileKey(file)));

      if (newFiles.length > 0) {
        toast({
          title: "TTL Files Added",
          description: `${newFiles.length} new file(s) added to ${activeTtlNode === LINKSET_NODE.id ? LINKSET_NODE.name : DISCIPLINES.find((d) => d.id === activeTtlNode)?.name ?? activeTtlNode}.`,
        });
      }

      if (duplicateFiles.length > 0) {
        toast({
          title: "TTL Files Already Loaded",
          description: `${duplicateFiles.length} file(s) were already loaded and were skipped.`,
        });
      }

      return {
        ...prev,
        [activeTtlNode]: [...existingFiles, ...newFiles],
      };
    });

    setTtlExpandedByNode((prev) => ({
      ...prev,
      [activeTtlNode]: true,
    }));

    event.target.value = "";
    setActiveTtlNode(null);
  };

  const removeTtlFile = (nodeId: string, fileKey: string) => {
    setLoadedTtlByNode((prev) => ({
      ...prev,
      [nodeId]: (prev[nodeId] ?? []).filter((file) => getTtlFileKey(file) !== fileKey),
    }));
  };

  const syncTtlNode = (nodeId: string, label: string) => {
    const ttlFiles = loadedTtlByNode[nodeId] ?? [];
    if (ttlFiles.length === 0) {
      toast({
        title: "No TTL Files Loaded",
        description: `Load TTL files for ${label} before syncing to Fuseki.`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sync to Fuseki",
      description: `Prepared ${ttlFiles.length} TTL file(s) under ${label}. Direct TTL upload from the project tree is not wired to a backend endpoint yet.`,
    });
  };

  const renderTtlLine = (nodeId: string, label: string, indentClass = "") => {
    const ttlId = lineId(nodeId, "ttl");
    const ttlFiles = loadedTtlByNode[nodeId] ?? [];
    const ttlExpanded = ttlExpandedByNode[nodeId] ?? false;

    return (
      <div className={cn("space-y-0.5", indentClass)}>
        <div className="flex items-center rounded text-[11px] py-1 px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTtlExpandedByNode((prev) => ({
                ...prev,
                [nodeId]: !ttlExpanded,
              }));
              onSelect(ttlId);
            }}
            className="h-6 w-6 mr-1 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={ttlExpanded ? `Collapse ${label} TTL files` : `Expand ${label} TTL files`}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ttlExpanded && "rotate-90")} />
          </button>
          <button
            onClick={() => {
              setTtlExpandedByNode((prev) => ({
                ...prev,
                [nodeId]: !ttlExpanded,
              }));
              onSelect(ttlId);
            }}
            className="flex-1 text-left font-mono tracking-wide"
          >
            TTL{ttlFiles.length > 0 ? ` (${ttlFiles.length})` : ""}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openTtlFilePicker(nodeId);
            }}
            className="group h-6 px-2 mr-1 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label={`Load TTL for ${label}`}
            title="Load"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-12 group-hover:opacity-100">
              Load
            </span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              syncTtlNode(nodeId, label);
            }}
            className="group h-6 px-2 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            aria-label={`Sync ${label} TTL to Fuseki`}
            title="Sync to Fuseki"
          >
            <CloudUpload className="h-3.5 w-3.5" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-24 group-hover:opacity-100">
              Sync to Fuseki
            </span>
          </button>
        </div>

        {ttlExpanded && ttlFiles.length > 0 && (
          <div className="ml-7 mr-1 mb-1 rounded border border-border/40 bg-background/20">
            {ttlFiles.map((file) => {
              const fileKey = getTtlFileKey(file);

              return (
                <div
                  key={`${nodeId}-${fileKey}`}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono"
                  title={file.name}
                >
                  <div className="flex-1 truncate text-muted-foreground">{file.name}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTtlFile(nodeId, fileKey);
                      toast({
                        title: "TTL File Removed",
                        description: `${file.name} was removed from ${label}.`,
                      });
                    }}
                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 border-r border-border/60 bg-sidebar/80 flex flex-col items-center py-3 gap-3">
        <button
          onClick={onToggleCollapsed}
          className="h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <div className="w-6 h-px bg-border/60" />
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Radio className="h-4 w-4 text-live" />
        <Eye className="h-4 w-4 text-muted-foreground" />
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-r border-border/60 bg-sidebar/80 backdrop-blur-md flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border/60">
        <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Project Explorer
        </span>
        <button
          onClick={onToggleCollapsed}
          className="h-7 w-7 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Project Tree */}
        <SectionHeader icon={Building2} label="Project Tree" />
        <div className="px-1.5 pb-2 space-y-1">
          <button
            onClick={() => setProjectTreeExpanded((prev) => !prev)}
            className="w-full flex items-center rounded-md text-xs border-l-2 border-transparent text-foreground/80 hover:bg-accent/60 transition-colors"
            aria-label={projectTreeExpanded ? "Collapse project" : "Expand project"}
          >
            <div className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pl-2 text-left">
              <ChevronRight
                className={cn(
                  "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                  projectTreeExpanded && "rotate-90"
                )}
              />
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{projectName}</span>
            </div>
          </button>

          {projectTreeExpanded && DISCIPLINES.map((discipline) => {
            const ifcId = lineId(discipline.id, "ifc");
            const ifcFiles = loadedIfcByDiscipline[discipline.id] ?? [];
            const ifcCount = ifcFiles.length;
            const ifcExpanded = ifcExpandedByDiscipline[discipline.id] ?? false;
            const disciplineExpanded = disciplineExpandedById[discipline.id] ?? true;

            return (
              <div key={discipline.id} className="rounded-md">
                <button
                  onClick={() => {
                    setDisciplineExpandedById((prev) => ({
                      ...prev,
                      [discipline.id]: !disciplineExpanded,
                    }));
                    onSelect(discipline.id);
                  }}
                  className={cn(
                    "w-full flex items-center rounded-md text-xs transition-colors border-l-2",
                    selectedId === discipline.id
                      ? "bg-primary/15 text-primary border-primary"
                      : "hover:bg-accent/60 border-transparent text-foreground/80 hover:text-foreground"
                  )}
                >
                  <span className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pl-5 text-left">
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                        disciplineExpanded && "rotate-90"
                      )}
                    />
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{discipline.name}</span>
                  </span>
                </button>

                {disciplineExpanded && <div className="pl-8 pr-1 space-y-0.5">
                  <div className="flex items-center rounded text-[11px] py-1 px-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIfcExpandedByDiscipline((prev) => ({
                          ...prev,
                          [discipline.id]: !ifcExpanded,
                        }));
                      }}
                      className="h-6 w-6 mr-1 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      aria-label={ifcExpanded ? "Collapse IFC files" : "Expand IFC files"}
                    >
                      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", ifcExpanded && "rotate-90")} />
                    </button>
                    <button
                      onClick={() => onSelect(ifcId)}
                      className="flex-1 text-left font-mono tracking-wide"
                    >
                      IFC{ifcCount > 0 ? ` (${ifcCount})` : ""}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openIfcFilePicker(discipline.id);
                      }}
                      className="group h-6 px-2 mr-1 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                      aria-label="Load IFC"
                      title="Load"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-12 group-hover:opacity-100">
                        Load
                      </span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(lineId(discipline.id, "ttl"));
                      }}
                      className="group h-6 px-2 rounded flex items-center gap-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                      aria-label="Convert to TTL"
                      title="Convert to TTL"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-24 group-hover:opacity-100">
                        Convert to TTL
                      </span>
                    </button>
                  </div>

                  {ifcExpanded && ifcCount > 0 && (
                    <div className="ml-7 mr-1 mb-1 rounded border border-border/40 bg-background/20">
                      {ifcFiles.map((file) => {
                        const fileKey = getIfcFileKey(file);
                        const fileSelectionId = makeIfcFileSelectionId(discipline.id, fileKey);
                        const isVisible = ifcVisibilityByFile[`${discipline.id}:${fileKey}`] ?? true;

                        return (
                          <div
                            key={`${discipline.id}-${fileKey}`}
                            className={cn(
                              "flex items-center gap-1 px-2 py-1 text-[10px] font-mono",
                              !isVisible && "opacity-50"
                            )}
                            title={file.name}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(fileSelectionId);
                              }}
                              className={cn(
                                "flex-1 truncate text-left",
                                selectedId === fileSelectionId ? "text-primary" : "text-muted-foreground hover:text-foreground"
                              )}
                              title={file.name}
                            >
                              {file.name}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onIfcVisibilityChange?.(discipline.id, fileKey, !isVisible);
                              }}
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              aria-label={isVisible ? `Hide ${file.name}` : `Show ${file.name}`}
                            >
                              {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onIfcFileRemoved?.(discipline.id, fileKey);
                                toast({
                                  title: "IFC File Removed",
                                  description: `${file.name} was removed from ${discipline.name}.`,
                                });
                              }}
                              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {renderTtlLine(discipline.id, discipline.name)}
                </div>}
              </div>
            );
          })}

          {projectTreeExpanded && [SENSOR_NODE, LINKSET_NODE].map((node) => {
            const nodeExpanded = disciplineExpandedById[node.id] ?? true;

            return (
              <div key={node.id} className="rounded-md">
                <button
                  onClick={() => {
                    setDisciplineExpandedById((prev) => ({
                      ...prev,
                      [node.id]: !nodeExpanded,
                    }));
                    onSelect(node.id);
                  }}
                  className={cn(
                    "w-full flex items-center rounded-md text-xs transition-colors border-l-2",
                    selectedId === node.id
                      ? "bg-primary/15 text-primary border-primary"
                      : "hover:bg-accent/60 border-transparent text-foreground/80 hover:text-foreground"
                  )}
                >
                  <span className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pl-5 text-left">
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                        nodeExpanded && "rotate-90"
                      )}
                    />
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{node.name}</span>
                  </span>
                </button>

                {nodeExpanded && <div className="pl-8 pr-1 space-y-0.5">{renderTtlLine(node.id, node.name)}</div>}
              </div>
            );
          })}

          <input
            ref={ifcFileInputRef}
            type="file"
            accept=".ifc"
            multiple
            className="hidden"
            onChange={handleIfcFileChange}
          />
          <input
            ref={ttlFileInputRef}
            type="file"
            accept=".ttl"
            multiple
            className="hidden"
            onChange={handleTtlFileChange}
          />
        </div>

        <div className="mx-3 h-px bg-border/60" />

        {/* Sensor Palette - grouped */}
        <SectionHeader icon={Radio} label="Sensor Palette" count={sensorsData.length} />
        <div className="pb-2">
          <SensorGroup
            kind="Temperature"
            icon={Thermometer}
            unit="°C"
            items={sensorsData.filter((s) => s.kind === "Temp")}
            selectedId={selectedId}
            onSelect={onSelect}
            visible={!hiddenGroups["Temp"]}
            onToggleVisible={() => toggleGroup("Temp")}
          />
          <SensorGroup
            kind="CO₂"
            icon={Wind}
            unit="ppm"
            items={sensorsData.filter((s) => s.kind === "CO₂" || s.kind === "CO2")}
            selectedId={selectedId}
            onSelect={onSelect}
            visible={!hiddenGroups["CO2"]}
            onToggleVisible={() => toggleGroup("CO2")}
          />
          <SensorGroup
            kind="Humidity"
            icon={Droplets}
            unit="%"
            items={sensorsData.filter((s) => s.kind === "Humidity")}
            selectedId={selectedId}
            onSelect={onSelect}
            visible={!hiddenGroups["Humidity"]}
            onToggleVisible={() => toggleGroup("Humidity")}
          />
        </div>

        <div className="mx-3 h-px bg-border/60" />

        {/* Selected Element details */}
        <SectionHeader icon={Eye} label="Selected Element" />
        <SelectedElementPanel selectedId={selectedId} liveMode={liveMode} />

        <div className="mx-3 h-px bg-border/60" />

        {/* Layer Toggles */}
        <SectionHeader icon={Eye} label="Layers" />
        <div className="px-3 pb-4 space-y-2.5">
          {(
            [
              { key: "geometry", label: "Geometry", hint: "IFC mesh & topology" },
              { key: "semantic", label: "Semantic Overlay", hint: "RDF · BOT · SAREF" },
              { key: "heatmap", label: "Heatmaps", hint: "Sensor density / values" },
            ] as const
          ).map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex items-start gap-2.5 cursor-pointer group p-2 rounded-md hover:bg-accent/40 transition-colors"
            >
              <Checkbox
                checked={layers[key]}
                onCheckedChange={() => onToggleLayer(key)}
                className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <div className="flex-1">
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[10px] text-muted-foreground">{hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-border/60 text-[10px] font-mono text-muted-foreground flex justify-between">
        <span>v0.4.2 · build 1138</span>
        <span className="text-live">● synced</span>
      </div>
    </aside>
  );
};
