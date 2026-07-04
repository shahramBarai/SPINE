import { CloudSync, DatabaseX, Loader, X } from "lucide-react";
import { TreeHeader } from "../TreeHeader";
import { api } from "utils/trpc";
import { UploadFileButton } from "../UploadFileButton";
import { cn } from "utils/index";

const TtlSectionButtons = ({
    projectId,
    discipline
}: {
    projectId: string;
    discipline: { id: string; name: string };
}) => {
    const utils = api.useUtils();
    const getUploadUrlMutation =
        api.digitalTwin.getPresignedUploadUrl.useMutation();

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
        utils.digitalTwin.getProjectFilesInfo.invalidate({
            projectId,
            discipline: discipline.id,
            fileTypes: ["ttl"]
        });
    };

    return (
        <div className="flex items-center">
            <UploadFileButton
                allowedFileTypes={[".ttl"]}
                maxFileSizeMB={1000} // 1 GB limit
                getUploadUrlString={getUploadUrlString}
                onUploadSuccess={onUploadSuccess}
            />
            <button
                onClick={() => {
                    // FIXME: Implement TTL sync logic
                    console.log("Sync TTL for", discipline.name);
                }}
                className="group h-6 px-2 rounded flex items-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                aria-label={`Sync ${discipline.name} TTL to Fuseki`}
                title="Sync to Fuseki"
            >
                <CloudSync className="h-3.5 w-3.5" />
                <span className="pl-1 max-w-0 overflow-hidden whitespace-nowrap opacity-0 text-[10px] font-medium transition-all duration-150 group-hover:max-w-24 group-hover:opacity-100">
                    Sync to Fuseki
                </span>
            </button>
        </div>
    );
};

function TtlSectionTree({
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
        data: ttlFiles,
        isLoading,
        isError
    } = api.digitalTwin.getProjectFilesInfo.useQuery({
        projectId: projectId,
        discipline: discipline.id,
        fileTypes: ["ttl"]
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

    if (!ttlFiles || isError) {
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
            TTL ({ttlFiles.length})
        </div>
    );

    return (
        <TreeHeader
            className={className}
            label={treeHeaderLabel}
            button={
                <TtlSectionButtons
                    projectId={projectId}
                    discipline={discipline}
                />
            }
        >
            <div className="ml-12 mr-1 mb-1 flex flex-col">
                {ttlFiles.length === 0 ? (
                    <div className="flex items-center justify-center py-1 text-sm">
                        <span className="text-[10px] text-muted-foreground">
                            No files found.
                        </span>
                    </div>
                ) : (
                    ttlFiles.map((file) => {
                        return (
                            <div
                                key={file.fileId}
                                className="border rounded flex items-center gap-1 px-2 py-1 text-[10px] font-mono"
                                title={file.fileName}
                            >
                                <div className="flex-1 truncate text-muted-foreground">
                                    {file.fileName}
                                </div>
                                <button
                                    onClick={() => {
                                        // FIXME: Implement TTL file removal logic
                                        console.log(
                                            "Remove TTL file:",
                                            file.fileName
                                        );
                                    }}
                                    className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                                    aria-label={`Remove ${file.fileName}`}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </TreeHeader>
    );
}

export { TtlSectionTree };
