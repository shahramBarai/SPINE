import { useState, Fragment } from "react";
import { ChevronRight, Eye, EyeOff, X } from "lucide-react";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import { toast } from "react-toastify";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { FloorItemsSection } from "./FloorItemsSection";

interface IfcFileHeaderProps {
    disciplineId: string;
    projectId: string;
    fileName: string;
    fileId: string;
    className?: string;
}

function IfcFileHeader({
    disciplineId,
    projectId,
    fileName,
    fileId,
    className
}: IfcFileHeaderProps) {
    const [floorsExpanded, setFloorsExpanded] = useState<boolean>(false);

    const { ifcFilesVisibility, setIfcFilesVisibility } = useDigitalTwin();

    const utils = api.useUtils();
    const deleteFileMutation = api.fileStorage.deleteProjectFile.useMutation();

    const handleDeleteFile = async () => {
        try {
            await deleteFileMutation.mutateAsync({
                projectId,
                discipline: disciplineId,
                fileId,
                fileName
            });
            await utils.fileStorage.getProjectFilesInfo.invalidate({
                projectId,
                discipline: disciplineId
            });
            toast.success(`${fileName} removed from storage.`);
        } catch (error) {
            console.error(error);
            toast.error(`Failed to remove ${fileName}.`);
        }
    };

    const isVisible = ifcFilesVisibility.includes(fileId);

    return (
        <div
            className={cn(
                "rounded border border-border/40 bg-background/20",
                !isVisible && "opacity-50",
                className
            )}
        >
            <Fragment key={`${disciplineId}-${fileId}-${fileName}`}>
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setFloorsExpanded((prev) => !prev);
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
                                floorsExpanded && "rotate-90"
                            )}
                        />
                        <span className="truncate">{fileName}</span>
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Wire up visibility toggle hook from Provider
                            setIfcFilesVisibility((prev) => {
                                if (prev.includes(fileId)) {
                                    return prev.filter((id) => id !== fileId);
                                } else {
                                    return [...prev, fileId];
                                }
                            });
                        }}
                        className={cn(
                            "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                            "hover:cursor-pointer hover:text-muted-foreground hover:bg-muted transition-all"
                        )}
                    >
                        {ifcFilesVisibility.includes(fileId) ? (
                            <Eye className="h-3 w-3" />
                        ) : (
                            <EyeOff className="h-3 w-3" />
                        )}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile();
                        }}
                        className={cn(
                            "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                            "hover:cursor-pointer hover:text-danger hover:bg-danger/10 transition-all"
                        )}
                        disabled={deleteFileMutation.isPending}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>

                {floorsExpanded && (
                    <FloorItemsSection
                        disciplineId={disciplineId}
                        projectId={projectId}
                        fileId={fileId}
                        fileName={fileName}
                        isVisible={isVisible}
                    />
                )}
            </Fragment>
        </div>
    );
}

export { IfcFileHeader };
