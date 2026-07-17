import { useState } from "react";
import {
    Loader2,
    FolderPlus,
    ChevronRight,
    ChevronDown,
    Trash2,
    Share2
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { UploadFileButton } from "components/feature/twin/LeftSidebar/ProjectTreeSection/UploadFileButton";
import { SyncToFusekiModal } from "./SyncToFusekiModal";

const ALLOWED_EXTENSIONS = [".ifc", ".ttl", ".pdf"];

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilesTab({ projectId }: { projectId: string }) {
    const utils = api.useUtils();
    const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState("");
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [syncTarget, setSyncTarget] = useState<{
        folder: string;
        fileId: string;
        fileName: string;
    } | null>(null);

    const {
        data: folders,
        isLoading,
        error
    } = api.project.listFiles.useQuery({ projectId });

    const createFolder = api.project.createFolder.useMutation({
        onSuccess: () => {
            utils.project.listFiles.invalidate({ projectId });
            setNewFolderName("");
            setShowNewFolder(false);
        },
        onError: (err) => toast.error(err.message)
    });

    const deleteFile = api.project.deleteFile.useMutation({
        onSuccess: () => utils.project.listFiles.invalidate({ projectId }),
        onError: (err) => toast.error(err.message)
    });

    const getUploadUrl = api.project.getUploadUrl.useMutation();

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading files...
            </div>
        );
    }

    if (error || !folders) {
        return (
            <p className="text-danger text-sm py-6">
                Failed to load project files.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end gap-2">
                {showNewFolder ? (
                    <div className="flex items-center gap-2">
                        <Input
                            autoFocus
                            placeholder="Folder name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={
                                !newFolderName.trim() || createFolder.isPending
                            }
                            onClick={() =>
                                createFolder.mutate({
                                    projectId,
                                    folder: newFolderName.trim()
                                })
                            }
                        >
                            Create
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowNewFolder(false);
                                setNewFolderName("");
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowNewFolder(true)}
                    >
                        <FolderPlus className="h-4 w-4" />
                        New folder
                    </Button>
                )}
            </div>

            {folders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                    No folders yet. Create one to start uploading files.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    {folders.map(({ folder, files }) => {
                        const isExpanded = expandedFolder === folder;
                        return (
                            <div
                                key={folder}
                                className="border border-border rounded-lg overflow-hidden"
                            >
                                <button
                                    className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-muted transition-colors"
                                    onClick={() =>
                                        setExpandedFolder(
                                            isExpanded ? null : folder
                                        )
                                    }
                                >
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium text-foreground">
                                        {folder}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        ({files.length})
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="border-t border-border p-3 flex flex-col gap-2">
                                        <div className="flex justify-end">
                                            <UploadFileButton
                                                allowedFileTypes={
                                                    ALLOWED_EXTENSIONS
                                                }
                                                maxFileSizeMB={1000}
                                                getUploadUrlString={async (
                                                    fileName
                                                ) => {
                                                    const {
                                                        uploadUrl
                                                    } =
                                                        await getUploadUrl.mutateAsync(
                                                            {
                                                                projectId,
                                                                folder,
                                                                fileName
                                                            }
                                                        );
                                                    return uploadUrl;
                                                }}
                                                onUploadSuccess={() =>
                                                    utils.project.listFiles.invalidate(
                                                        { projectId }
                                                    )
                                                }
                                            />
                                        </div>

                                        {files.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-2">
                                                No files in this folder yet.
                                            </p>
                                        ) : (
                                            files.map((file) => {
                                                const isTtl = file.fileName
                                                    .toLowerCase()
                                                    .endsWith(".ttl");
                                                return (
                                                    <div
                                                        key={file.fileId}
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-1.5 rounded border border-border text-sm"
                                                        )}
                                                    >
                                                        <span className="flex-1 truncate text-foreground">
                                                            {file.fileName}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatSize(
                                                                file.size
                                                            )}
                                                        </span>
                                                        {isTtl && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title="Load to Fuseki"
                                                                onClick={() =>
                                                                    setSyncTarget(
                                                                        {
                                                                            folder,
                                                                            fileId: file.fileId,
                                                                            fileName:
                                                                                file.fileName
                                                                        }
                                                                    )
                                                                }
                                                            >
                                                                <Share2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={
                                                                deleteFile.isPending
                                                            }
                                                            title="Delete file"
                                                            onClick={() =>
                                                                deleteFile.mutate(
                                                                    {
                                                                        projectId,
                                                                        folder,
                                                                        fileId: file.fileId,
                                                                        fileName:
                                                                            file.fileName
                                                                    }
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4 text-danger" />
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {syncTarget && (
                <SyncToFusekiModal
                    projectId={projectId}
                    folder={syncTarget.folder}
                    fileId={syncTarget.fileId}
                    fileName={syncTarget.fileName}
                    open={!!syncTarget}
                    setOpen={(open) => {
                        if (!open) setSyncTarget(null);
                    }}
                />
            )}
        </div>
    );
}

export { FilesTab };
