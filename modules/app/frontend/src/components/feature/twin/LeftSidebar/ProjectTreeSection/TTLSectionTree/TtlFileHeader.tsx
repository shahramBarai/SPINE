import { useState } from "react";
import { ChevronRight, Eye, EyeOff } from "lucide-react";
import { cn } from "utils/index";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { SyncToFusekiButton } from "./SyncToFusekiButton";
import { DeleteFileButton } from "../DeleteFileButton";
import { FusekiTreeSection } from "./FusekiTreeSection";

interface TtlFileHeaderProps {
    disciplineId: string;
    projectId: string;
    fileName: string;
    fileId: string;
    className?: string;
}

function TtlFileHeader({
    disciplineId,
    projectId,
    fileName,
    fileId,
    className
}: TtlFileHeaderProps) {
    const [treeExpanded, setTreeExpanded] = useState<boolean>(false);
    const { ttlFilesHidden, setTtlFilesHidden } = useDigitalTwin();
    const isVisible = !ttlFilesHidden.includes(fileId);

    return (
        <div
            className={cn(
                "rounded border border-border/40 bg-background/20",
                !isVisible && "opacity-50",
                className
            )}
        >
            <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setTreeExpanded((prev) => !prev);
                    }}
                    className={cn(
                        "flex-1 truncate text-left inline-flex items-center gap-1",
                        "text-muted-foreground hover:text-foreground",
                        "hover:cursor-pointer"
                    )}
                >
                    <ChevronRight
                        className={cn(
                            "h-3 w-3 shrink-0 transition-transform",
                            treeExpanded && "rotate-90"
                        )}
                    />
                    <span className="truncate">{fileName}</span>
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setTtlFilesHidden((prev) =>
                            prev.includes(fileId)
                                ? prev.filter((id) => id !== fileId)
                                : [...prev, fileId]
                        );
                    }}
                    title={
                        isVisible
                            ? "Exclude from relationship graph search"
                            : "Include in relationship graph search"
                    }
                    className={cn(
                        "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                        "hover:cursor-pointer hover:text-muted-foreground hover:bg-muted transition-all"
                    )}
                >
                    {isVisible ? (
                        <Eye className="h-3 w-3" />
                    ) : (
                        <EyeOff className="h-3 w-3" />
                    )}
                </button>

                <SyncToFusekiButton
                    projectId={projectId}
                    disciplineId={disciplineId}
                    fileId={fileId}
                    fileName={fileName}
                />

                <DeleteFileButton
                    projectId={projectId}
                    disciplineId={disciplineId}
                    fileId={fileId}
                    fileName={fileName}
                />
            </div>

            {treeExpanded && (
                <FusekiTreeSection
                    projectId={projectId}
                    disciplineId={disciplineId}
                    fileId={fileId}
                />
            )}
        </div>
    );
}

export { TtlFileHeader };
