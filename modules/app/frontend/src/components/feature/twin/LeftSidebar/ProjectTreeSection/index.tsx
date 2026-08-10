import { Building2 } from "lucide-react";
import { cn } from "utils/index";
import { IfcSectionTree } from "./IFCSectionTree";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { TreeHeader } from "components/complex/TreeHeader";
import { DISCIPLINES } from "utils/disciplines";

const HeaderLabel = ({ id, name }: { id: string; name: string }) => {
    const discipline = DISCIPLINES.find((d) => d.id === id);
    const Icon = discipline?.icon ?? Building2;
    return (
        <span className={cn("flex-1 flex items-center gap-1.5")}>
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs truncate">{name}</span>
        </span>
    );
};

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
                {DISCIPLINES.filter(
                    (discipline) => discipline.id !== "disc-sahko:linkset"
                ).map((discipline) => (
                    <TreeHeader
                        key={discipline.id}
                        className={cn(
                            "pl-5 border-l-3",
                            selectedObjectIds.includes(discipline.id)
                                ? "bg-primary/15 text-primary border-primary"
                                : "hover:bg-accent/60 border-transparent text-foreground/80"
                        )}
                        label={
                            <HeaderLabel
                                id={discipline.id}
                                name={discipline.name}
                            />
                        }
                    >
                        <IfcSectionTree
                            className="pl-8 pr-1"
                            discipline={discipline}
                            projectId={projectInfo.id}
                        />
                    </TreeHeader>
                ))}
            </>
        </TreeHeader>
    );
}

export { ProjectTreeSection };
