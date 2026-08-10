import { api } from "utils/trpc";
import { Loader, DatabaseX, Eye, EyeOff } from "lucide-react";
import { TreeHeader } from "components/complex/TreeHeader";
import { cn } from "utils/index";
import { useDigitalTwin } from "hooks/useDigitalTwin";

function IfcSectionTree({
    discipline,
    projectId,
    className
}: {
    discipline: { id: string; name: string };
    projectId: string;
    className?: string;
}) {
    const { visibleIfcFiles, toggleIfcFile } = useDigitalTwin();

    // --- Backend tRPC calls ---
    const {
        data: ifcFiles,
        isLoading,
        isError
    } = api.digitalTwin.getProjectFilesInfo.useQuery({
        projectId: projectId,
        discipline: discipline.id,
        fileTypes: ["ifc"]
    });

    // --- Render Section ---
    if (isLoading) {
        return (
            <div
                className={cn(
                    "rounded-b-md flex items-center justify-center py-2 text-sm",
                    className
                )}
            >
                <Loader className="w-4 h-4 mr-1 animate-spin" />
                <span className="text-[10px] text-muted-foreground">
                    Loading...
                </span>
            </div>
        );
    }

    if (!ifcFiles || isError) {
        return (
            <div
                className={cn(
                    "rounded-b-md flex items-center justify-center py-2 text-sm bg-muted",
                    className
                )}
            >
                <DatabaseX className="w-4 h-4 mr-1 text-danger" />
                <span className="text-[10px] text-danger">
                    Error loading files.
                </span>
            </div>
        );
    }

    const treeHeaderLabel = (fileName: string) => (
        <div className={cn("text-[11px] font-mono text-foreground truncate")}>
            {fileName.replace(/\.ifc$/i, "")}
        </div>
    );

    return (
        <>
            {ifcFiles.length === 0 ? (
                <div
                    className={cn(
                        "flex items-center justify-center py-1 text-sm",
                        className
                    )}
                >
                    <span className="text-[10px] text-muted-foreground">
                        No files found.
                    </span>
                </div>
            ) : (
                ifcFiles.map((file) => {
                    const isVisible = visibleIfcFiles.some(
                        (f) => f.fileId === file.fileId
                    );
                    return (
                        <TreeHeader
                            key={file.fileId}
                            className={cn("pl-12 pr-2", className)}
                            label={treeHeaderLabel(file.fileName)}
                            disable={!isVisible}
                            button={
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleIfcFile({
                                            discipline: discipline.id,
                                            fileId: file.fileId,
                                            fileName: file.fileName
                                        });
                                    }}
                                    title={
                                        isVisible
                                            ? "Exclude from 3D view"
                                            : "Include in 3D view"
                                    }
                                    className={cn(
                                        "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                                        "hover:cursor-pointer hover:text-primary hover:bg-primary/10 transition-all"
                                    )}
                                >
                                    {isVisible ? (
                                        <Eye className="h-3 w-3" />
                                    ) : (
                                        <EyeOff className="h-3 w-3" />
                                    )}
                                </button>
                            }
                        >
                            <span className="pl-16 text-[10px] text-muted-foreground font-mono">
                                TODO: Add IFC file components here
                            </span>
                        </TreeHeader>
                    );
                })
            )}
        </>
    );
}

export { IfcSectionTree };
