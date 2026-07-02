import { useState } from "react";
import {
    ChevronRight,
    Building2,
    CloudUpload,
    FolderOpen,
    X
} from "lucide-react";
import { cn } from "utils/index";
import { IfcSectionTree } from "./IFCSectionTree";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { TtlSectionTree } from "./TTLSectionTree";

type LoadedFile = File;
export const getFileKey = (file: LoadedFile): string =>
    `${file.name}:${file.size}:${file.lastModified}`;

export const DISCIPLINES = [
    { id: "disc-ark", name: "ARK - Architectural" },
    { id: "disc-rak", name: "RAK - Structural" },
    { id: "disc-lvi", name: "LVI - HVAC & Plumbing" },
    { id: "disc-sahko", name: "SÄHKO - Electrical" }
] as const;

export const LINKSET_NODE = {
    id: "disc-sahko:linkset",
    name: "Linkset"
} as const;
export const SENSOR_NODE = { id: "sensor-node", name: "Sensor" } as const;

export const ProjectTreeSection = () => {
    const [projectTreeExpanded, setProjectTreeExpanded] = useState(true);
    const [disciplineExpandedById, setDisciplineExpandedById] = useState<
        Record<string, boolean>
    >({});

    const { projectInfo, focusObjectId, setFocusObjectId } = useDigitalTwin();

    if (!projectInfo) {
        return (
            <div className="flex items-center justify-center py-1 font-mono text-muted-foreground">
                <span className="text-xs">No project selected</span>
            </div>
        );
    }

    return (
        <div className="px-1.5 pb-2 space-y-1">
            <button
                onClick={() => setProjectTreeExpanded((p) => !p)}
                className="w-full flex items-center rounded-md text-xs border-l-2 border-transparent text-foreground/80 hover:bg-accent/60 transition-colors"
            >
                <div className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pl-2 text-left">
                    <ChevronRight
                        className={cn(
                            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                            projectTreeExpanded && "rotate-90"
                        )}
                    />
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{projectInfo.name}</span>
                </div>
            </button>

            {projectTreeExpanded && (
                <>
                    {DISCIPLINES.map((discipline) => {
                        return (
                            <DisciplineSection
                                key={discipline.id}
                                discipline={discipline}
                                projectId={projectInfo.id}
                            />
                        );
                    })}

                    {[SENSOR_NODE, LINKSET_NODE].map((node) => {
                        const nodeExpanded =
                            disciplineExpandedById[node.id] ?? true;
                        return (
                            <div key={node.id} className="rounded-md">
                                <button
                                    onClick={() => {
                                        setDisciplineExpandedById((p) => ({
                                            ...p,
                                            [node.id]: !nodeExpanded
                                        }));
                                        setFocusObjectId(node.id);
                                    }}
                                    className={cn(
                                        "w-full flex items-center rounded-md text-xs transition-colors border-l-2",
                                        focusObjectId === node.id
                                            ? "bg-primary/15 text-primary border-primary"
                                            : "hover:bg-accent/60 border-transparent text-foreground/80"
                                    )}
                                >
                                    <span className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pl-5 text-left">
                                        <ChevronRight
                                            className={cn(
                                                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                                                nodeExpanded && "rotate-90"
                                            )}
                                        />
                                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="truncate">
                                            {node.name}
                                        </span>
                                    </span>
                                </button>
                                {nodeExpanded && (
                                    <div className="pl-8 pr-1 space-y-0.5">
                                        {renderTtlLine(node.id, node.name)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};

const DisciplineSection = ({
    discipline,
    projectId
}: {
    discipline: { id: string; name: string };
    projectId: string;
}) => {
    const [sectionExpanded, setSectionExpanded] = useState<boolean>(false);
    const { focusObjectId, setFocusObjectId } = useDigitalTwin();

    return (
        <div key={discipline.id} className="rounded-md">
            <button
                onClick={() => {
                    setSectionExpanded((prev) => !prev);
                    setFocusObjectId(discipline.id);
                }}
                className={cn(
                    "w-full flex items-center rounded-md text-xs transition-colors border-l-2",
                    focusObjectId === discipline.id
                        ? "bg-primary/15 text-primary border-primary"
                        : "hover:bg-accent/60 border-transparent text-foreground/80"
                )}
            >
                <span className="flex-1 min-w-0 flex items-center gap-1.5 py-1.5 pl-5 text-left">
                    <ChevronRight
                        className={cn(
                            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                            sectionExpanded && "rotate-90"
                        )}
                    />
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{discipline.name}</span>
                </span>
            </button>

            {sectionExpanded && (
                <div className="pl-8 pr-1">
                    <IfcSectionTree
                        discipline={discipline}
                        projectId={projectId}
                    />
                    <TtlSectionTree
                        discipline={discipline}
                        projectId={projectId}
                    />
                </div>
            )}
        </div>
    );
};

const renderTtlLine = (nodeId: string, label: string, indentClass = "") => {
    // const ttlId = `${nodeId}:ttl`;
    const ttlExpanded: File[] = [];
    const ttlFiles: File[] = []; // Replace with actual TTL files for the node

    const getTtlFileKey = (file: File): string =>
        `${file.name}:${file.size}:${file.lastModified}`;

    return (
        <div className={cn("space-y-0.5", indentClass)}>
            <div className="flex items-center rounded text-[11px] py-1 px-2">
                <button
                    onClick={() => {
                        // FIXME: Implement TTL expand/collapse logic
                        console.log("Toggle TTL expand/collapse");
                    }}
                    className="h-6 w-6 mr-1 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    aria-label={
                        ttlExpanded
                            ? `Collapse ${label} TTL files`
                            : `Expand ${label} TTL files`
                    }
                >
                    <ChevronRight
                        className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            ttlExpanded && "rotate-90"
                        )}
                    />
                </button>
                <div className="flex-1 text-left font-mono tracking-wide">
                    TTL{ttlFiles.length > 0 ? ` (${ttlFiles.length})` : ""}
                </div>
                <button
                    onClick={() => {
                        // FIXME: Implement TTL load logic
                        console.log("Load TTL for", label);
                    }}
                    className="group h-6 px-2 mr-1 rounded flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    aria-label={`Load TTL for ${label}`}
                    title="Load"
                >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="pl-1 max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-12 group-hover:opacity-100">
                        Load
                    </span>
                </button>
                <button
                    onClick={() => {
                        // FIXME: Implement TTL sync logic
                        console.log("Sync TTL for", label);
                    }}
                    className="group h-6 px-2 rounded flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    aria-label={`Sync ${label} TTL to Fuseki`}
                    title="Sync to Fuseki"
                >
                    <CloudUpload className="h-3.5 w-3.5" />
                    <span className="pl-1 max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-24 group-hover:opacity-100">
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
                                <div className="flex-1 truncate text-muted-foreground">
                                    {file.name}
                                </div>
                                <button
                                    onClick={() => {
                                        // FIXME: Implement TTL file removal logic
                                        console.log(
                                            "Remove TTL file:",
                                            file.name
                                        );
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
