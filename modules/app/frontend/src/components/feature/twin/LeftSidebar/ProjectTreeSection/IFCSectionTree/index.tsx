import { api } from "utils/trpc";
import { Loader, DatabaseX } from "lucide-react";
import { TreeHeader } from "components/complex/TreeHeader";
import { cn } from "utils/index";

function IfcSectionTree({
    discipline,
    projectId,
    className
}: {
    discipline: { id: string; name: string };
    projectId: string;
    className?: string;
}) {
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

    const treeHeaderLabel = (
        <div className="text-[11px] text-foreground font-mono truncate">
            IFC ({ifcFiles.length})
        </div>
    );

    return (
        <TreeHeader className={className} label={treeHeaderLabel}>
            <div className="ml-12 mr-1 mb-1 flex flex-col">
                {ifcFiles.length === 0 ? (
                    <div className="flex items-center justify-center py-1 text-sm">
                        <span className="text-[10px] text-muted-foreground">
                            No files found.
                        </span>
                    </div>
                ) : (
                    ifcFiles.map((file) => (
                        <div
                            key={file.fileId}
                            className="border rounded flex items-center gap-1 px-2 py-1 text-[10px] font-mono"
                            title={file.fileName}
                        >
                            <div className="flex-1 truncate text-muted-foreground">
                                {file.fileName}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </TreeHeader>
    );
}

export { IfcSectionTree };
