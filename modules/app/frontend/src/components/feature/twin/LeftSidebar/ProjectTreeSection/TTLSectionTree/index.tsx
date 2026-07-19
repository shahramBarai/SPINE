import { DatabaseX, Loader } from "lucide-react";
import { TreeHeader } from "components/complex/TreeHeader";
import { api } from "utils/trpc";
import { UploadFileButton } from "../UploadFileButton";
import { cn } from "utils/index";
import { TtlFileHeader } from "./TtlFileHeader";

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
                    ttlFiles.map((file) => (
                        <TtlFileHeader
                            key={file.fileId}
                            projectId={projectId}
                            disciplineId={discipline.id}
                            fileId={file.fileId}
                            fileName={file.fileName}
                        />
                    ))
                )}
            </div>
        </TreeHeader>
    );
}

export { TtlSectionTree };
