import { IfcFileHeader } from "./IfcFileHeader";
import { api } from "utils/trpc";
import { Loader, DatabaseX, FileCode2 } from "lucide-react";
import { UploadFileButton } from "../UploadFileButton";
import { TreeHeader } from "../TreeHeader";
import { cn } from "utils/index";

const IfcSectionButtons = ({
    discipline,
    projectId
}: {
    discipline: { id: string; name: string };
    projectId: string;
}) => {
    const utils = api.useUtils();
    const getUploadUrlMutation =
        api.fileStorage.getPresignedUploadUrl.useMutation();

    // Function to get the pre-signed upload URL for a given file name
    const getUploadUrlString = async (fileName: string): Promise<string> => {
        const { uploadUrl } = await getUploadUrlMutation.mutateAsync({
            projectId,
            fileName: fileName,
            discipline: discipline.id
        });
        return uploadUrl;
    };

    // Function to handle actions after a successful upload
    const onUploadSuccess = () => {
        utils.fileStorage.getProjectFilesInfo.invalidate({
            projectId,
            discipline: discipline.id,
            fileTypes: ["ifc"]
        });
    };

    return (
        <div className="flex items-center">
            <UploadFileButton
                allowedFileTypes={[".ifc"]}
                maxFileSizeMB={1000} // 1 GB limit
                getUploadUrlString={getUploadUrlString}
                onUploadSuccess={onUploadSuccess}
            />
            <button
                onClick={() => {
                    // TODO: Wire up with future IFC Provider (TTL Conversion trigger)
                    console.log("Convert IFC to TTL for", discipline.id);
                }}
                className="group h-6 px-2 rounded flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                aria-label="Convert to TTL"
                title="Convert to TTL"
            >
                <FileCode2 className="h-3.5 w-3.5" />
                <span className="pl-1 max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-24 group-hover:opacity-100">
                    Convert to TTL
                </span>
            </button>
        </div>
    );
};

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
    } = api.fileStorage.getProjectFilesInfo.useQuery({
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
        <TreeHeader
            className={className}
            label={treeHeaderLabel}
            button={
                <IfcSectionButtons
                    discipline={discipline}
                    projectId={projectId}
                />
            }
        >
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
                    return (
                        <IfcFileHeader
                            key={file.fileId}
                            disciplineId={discipline.id}
                            projectId={projectId}
                            fileName={file.fileName}
                            fileId={file.fileId}
                            className="ml-12 mr-1 mb-1"
                        />
                    );
                })
            )}
        </TreeHeader>
    );
}

export { IfcSectionTree };
