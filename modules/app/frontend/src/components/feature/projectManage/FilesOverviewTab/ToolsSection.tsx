import { useState } from "react";
import { Loader2, Wrench } from "lucide-react";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { SectionCard } from "components/complex/SectionCard";
import { RunIfcToTtlModal } from "../modals/RunIfcToTtlModal";

function TypeBadge({ type }: { type: string }) {
    return (
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {type}
        </span>
    );
}

function ToolsSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const [runModalToolId, setRunModalToolId] = useState<string | null>(null);
    const utils = api.useUtils();

    const {
        data: tools,
        isLoading,
        isError
    } = api.project.tools.listTools.useQuery();

    if (isLoading) {
        return (
            <SectionCard title="Tools" className={className}>
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading tools...
                </div>
            </SectionCard>
        );
    }

    if (isError || !tools) {
        return (
            <SectionCard title="Tools" className={className}>
                <p className="text-danger text-sm py-6">
                    Failed to load project tools.
                </p>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="Tools" className={className}>
            <div className="flex flex-col gap-3">
                {tools.map((tool) => (
                    <div
                        key={tool.id}
                        className="flex items-start gap-3 border border-border rounded-lg p-4"
                    >
                        <Wrench className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                            <span className="font-medium text-foreground">
                                {tool.name}
                            </span>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {tool.description}
                            </p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {tool.inputTypes.map((type) => (
                                    <TypeBadge key={`in-${type}`} type={type} />
                                ))}
                                {tool.outputTypes.length > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">
                                            →
                                        </span>
                                        {tool.outputTypes.map((type) => (
                                            <TypeBadge
                                                key={`out-${type}`}
                                                type={type}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!tool.available}
                            title={
                                tool.available
                                    ? undefined
                                    : "Not yet implemented"
                            }
                            onClick={() => setRunModalToolId(tool.id)}
                        >
                            Run
                        </Button>
                    </div>
                ))}
            </div>

            {/* Only ifc-to-ttl has a real backend integration so far - see tools.ts. */}
            <RunIfcToTtlModal
                projectId={projectId}
                open={runModalToolId === "ifc-to-ttl"}
                setOpen={(open) =>
                    setRunModalToolId(open ? "ifc-to-ttl" : null)
                }
                onSuccess={() =>
                    utils.project.files.listFiles.invalidate({ projectId })
                }
            />
        </SectionCard>
    );
}

export { ToolsSection };
