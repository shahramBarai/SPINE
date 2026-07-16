import {
    Building,
    Building2,
    Unplug,
    HousePlug,
    Cpu,
    BrickWall,
    AudioWaveform
} from "lucide-react";
import { cn } from "utils/index";
import { IfcSectionTree } from "./IFCSectionTree";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { TtlSectionTree } from "./TTLSectionTree";
import { TreeHeader } from "./TreeHeader";

interface Discipline {
    id: string;
    name: string;
    icon: typeof Building2;
}

export const DISCIPLINES: Discipline[] = [
    { id: "disc-ark", name: "ARK - Architectural", icon: Building },
    { id: "disc-rak", name: "RAK - Structural", icon: BrickWall },
    { id: "disc-lvi", name: "LVI - HVAC & Plumbing", icon: AudioWaveform },
    { id: "disc-sahko", name: "SÄHKO - Electrical", icon: HousePlug },
    { id: "sensor-node", name: "Sensor", icon: Cpu },
    { id: "disc-sahko:linkset", name: "Linkset", icon: Unplug }
];

const HeaderLabel = ({ discipline }: { discipline: Discipline }) => (
    <span className={cn("flex-1 flex items-center gap-1.5")}>
        <discipline.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs truncate">{discipline.name}</span>
    </span>
);

function ProjectTreeSection({ className }: { className?: string }) {
    const { projectInfo, selectedObjectIds } = useDigitalTwin();

    return (
        <TreeHeader
            className={className}
            label={
                <div className="flex items-center gap-1.5 text-left">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-xs truncate">{projectInfo.name}</span>
                </div>
            }
            defaultExpanded={true}
        >
            <>
                {DISCIPLINES.map((discipline) => {
                    return (
                        <TreeHeader
                            key={discipline.id}
                            className={cn(
                                "pl-5 border-l-3",
                                selectedObjectIds.includes(discipline.id)
                                    ? "bg-primary/15 text-primary border-primary"
                                    : "hover:bg-accent/60 border-transparent text-foreground/80"
                            )}
                            label={<HeaderLabel discipline={discipline} />}
                        >
                            <>
                                {discipline.id !== "disc-sahko:linkset" && (
                                    <IfcSectionTree
                                        className="pl-8 pr-1"
                                        discipline={discipline}
                                        projectId={projectInfo.id}
                                    />
                                )}
                                <TtlSectionTree
                                    className="pl-8 pr-1"
                                    discipline={discipline}
                                    projectId={projectInfo.id}
                                />
                            </>
                        </TreeHeader>
                    );
                })}
            </>
        </TreeHeader>
    );
}

export { ProjectTreeSection };
