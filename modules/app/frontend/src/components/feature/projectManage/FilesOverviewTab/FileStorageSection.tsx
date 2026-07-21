import { useState } from "react";
import { Loader2, Folder, File, Download } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { BACKEND_URL } from "utils/backendUrl";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { TreeHeader } from "components/complex/TreeHeader";
import { SectionCard } from "components/complex/SectionCard";
import { UploadFileButton } from "components/feature/twin/LeftSidebar/ProjectTreeSection/UploadFileButton";
import { DeleteFileButton } from "../DeleteFileButton";
import { DeleteFolderButton } from "../DeleteFolderButton";
import { cn } from "utils/index";

const ALLOWED_EXTENSIONS = [".ifc", ".ttl", ".pdf"];

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// `date` may arrive as an ISO string over the wire even though its static
// type says Date, since plain JSON (no superjson transformer here) can't
// carry Date instances - wrapping in `new Date(...)` normalizes either case.
function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(date));
}

function buildDownloadUrl(
    projectId: string,
    folder: string,
    fileId: string,
    fileName: string
): string {
    const objectKey = [projectId, folder, `${fileId}_${fileName}`]
        .map(encodeURIComponent)
        .join("/");
    return `${BACKEND_URL}/files/${objectKey}`;
}

function FileStorageSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const utils = api.useUtils();
    const [newFolderName, setNewFolderName] = useState("");
    const [showNewFolder, setShowNewFolder] = useState(false);

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

    const getUploadUrl = api.project.getUploadUrl.useMutation();

    if (isLoading) {
        return (
            <SectionCard title="File Storage" className={className}>
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading files...
                </div>
            </SectionCard>
        );
    }

    if (error || !folders) {
        return (
            <SectionCard title="File Storage" className={className}>
                <p className="text-danger text-sm py-6">
                    Failed to load project files.
                </p>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="File Storage" className={className}>
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {folders.map(({ folder, files, totalSize, lastModified }) => (
                    <TreeHeader
                        key={folder}
                        className="px-2 hover:bg-muted"
                        label={
                            <span className="flex items-center gap-2 min-w-0">
                                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="flex flex-col min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="font-medium text-foreground truncate">
                                            {folder}
                                        </span>
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            ({files.length})
                                        </span>
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                        {formatSize(totalSize)}
                                        {lastModified &&
                                            ` · Updated ${formatDate(lastModified)}`}
                                    </span>
                                </span>
                            </span>
                        }
                        button={
                            <div className="flex items-center gap-1">
                                <UploadFileButton
                                    allowedFileTypes={ALLOWED_EXTENSIONS}
                                    maxFileSizeMB={1000}
                                    getUploadUrlString={async (fileName) => {
                                        const { uploadUrl } =
                                            await getUploadUrl.mutateAsync({
                                                projectId,
                                                folder,
                                                fileName
                                            });
                                        return uploadUrl;
                                    }}
                                    onUploadSuccess={() =>
                                        utils.project.listFiles.invalidate({
                                            projectId
                                        })
                                    }
                                />
                                <DeleteFolderButton
                                    projectId={projectId}
                                    folder={folder}
                                    fileNames={files.map(
                                        (file) => file.fileName
                                    )}
                                    onSuccess={() =>
                                        utils.project.listFiles.invalidate({
                                            projectId
                                        })
                                    }
                                />
                            </div>
                        }
                    >
                        <div className="pr-2 pb-2 flex flex-col gap-1">
                            {files.length === 0 ? (
                                <p className="pl-8 text-xs text-muted-foreground text-center py-2">
                                    No files in this folder yet.
                                </p>
                            ) : (
                                files.map((file) => {
                                    return (
                                        <div
                                            key={file.fileId}
                                            className="pl-8 flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-sm"
                                        >
                                            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="flex-1 flex flex-col min-w-0">
                                                <span className="truncate text-foreground">
                                                    {file.fileName}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {formatSize(file.size)}
                                                    {file.lastModified &&
                                                        ` · Uploaded ${formatDate(file.lastModified)}`}
                                                </span>
                                            </span>
                                            <a
                                                href={buildDownloadUrl(
                                                    projectId,
                                                    folder,
                                                    file.fileId,
                                                    file.fileName
                                                )}
                                                download
                                                title="Download file"
                                                className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </a>
                                            <DeleteFileButton
                                                projectId={projectId}
                                                folder={folder}
                                                fileId={file.fileId}
                                                fileName={file.fileName}
                                                onSuccess={() =>
                                                    utils.project.listFiles.invalidate(
                                                        { projectId }
                                                    )
                                                }
                                            />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </TreeHeader>
                ))}

                {showNewFolder ? (
                    <div className="flex items-center gap-2 px-2 py-2">
                        <Input
                            autoFocus
                            placeholder="Folder name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && newFolderName.trim()) {
                                    createFolder.mutate({
                                        projectId,
                                        folder: newFolderName.trim()
                                    });
                                }
                                if (e.key === "Escape") {
                                    setShowNewFolder(false);
                                    setNewFolderName("");
                                }
                            }}
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
                    <button
                        type="button"
                        onClick={() => setShowNewFolder(true)}
                        className={cn(
                            "w-full py-2 text-center text-sm text-muted-foreground transition-colors",
                            "hover:cursor-pointer hover:text-primary hover:bg-muted"
                        )}
                    >
                        + New folder
                    </button>
                )}
            </div>
        </SectionCard>
    );
}

export { FileStorageSection };
