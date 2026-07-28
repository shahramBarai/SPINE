import { useRef, useState } from "react";
import { Loader2, Folder, File, Download } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { TreeHeader } from "components/complex/TreeHeader";
import { SectionCard } from "components/complex/SectionCard";
import { UploadFileButton } from "components/feature/twin/LeftSidebar/ProjectTreeSection/UploadFileButton";
import { DeleteFileButton } from "../DeleteFileButton";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { DISCIPLINES } from "utils/disciplines";
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

function FileStorageSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const utils = api.useUtils();
    const uploadFolderRef = useRef<string>("");
    const uploadFileIdRef = useRef<string | null>(null);
    // Folder names the user just created but haven't uploaded a file into
    // yet - listFiles only ever returns folders that actually contain a
    // file, so a brand new folder needs to be rendered locally until its
    // first upload lands and the real listing picks it up.
    const [pendingFolders, setPendingFolders] = useState<string[]>([]);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");

    const {
        data: folders,
        isLoading,
        error
    } = api.project.files.listFiles.useQuery({ projectId });

    const getUploadUrl = api.project.files.getUploadUrl.useMutation();
    const confirmUpload = api.project.files.confirmUpload.useMutation({
        onSuccess: () =>
            utils.project.files.listFiles.invalidate({ projectId }),
        onError: (err) => toast.error(err.message)
    });

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

    const existingFolderNames = new Set(
        folders.map((f) => f.folder).filter(Boolean)
    );
    const emptyPendingGroups = pendingFolders
        .filter((folder) => !existingFolderNames.has(folder))
        .map((folder) => ({
            folder,
            files: [] as (typeof folders)[number]["files"],
            totalSize: 0,
            lastModified: undefined as Date | string | undefined
        }));
    const groups = [...folders, ...emptyPendingGroups];

    const addPendingFolder = (name: string) => {
        setPendingFolders((prev) =>
            prev.includes(name) ? prev : [...prev, name]
        );
        setShowNewFolder(false);
        setNewFolderName("");
    };

    return (
        <SectionCard title="File Storage" className={className}>
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {groups.map(({ folder, files, totalSize, lastModified }) => (
                    <TreeHeader
                        key={folder}
                        className="px-2 hover:bg-muted"
                        label={
                            <span className="flex items-center gap-2 min-w-0">
                                <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="flex flex-col min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="font-medium text-foreground truncate">
                                            {folder || "root"}
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
                            folder && (
                                <UploadFileButton
                                    allowedFileTypes={ALLOWED_EXTENSIONS}
                                    maxFileSizeMB={1000}
                                    getUploadUrlString={async (fileName) => {
                                        const { uploadUrl, fileId } =
                                            await getUploadUrl.mutateAsync({
                                                projectId,
                                                folder,
                                                fileName
                                            });
                                        uploadFolderRef.current = folder;
                                        uploadFileIdRef.current = fileId;
                                        return uploadUrl;
                                    }}
                                    onUploadSuccess={(fileName) => {
                                        if (!uploadFileIdRef.current) return;
                                        confirmUpload.mutate({
                                            projectId,
                                            folder: uploadFolderRef.current,
                                            fileId: uploadFileIdRef.current,
                                            fileName
                                        });
                                    }}
                                />
                            )
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
                                            <span
                                                // TODO: fix this to be a proper lint that allows for downloading files
                                                title="Download file"
                                                className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </span>
                                            <DeleteFileButton
                                                projectId={projectId}
                                                fileId={file.fileId}
                                                fileName={file.fileName}
                                                onSuccess={() =>
                                                    utils.project.files.listFiles.invalidate(
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
                    <div className="flex flex-col gap-2 px-2 py-2">
                        <div className="flex items-center gap-2">
                            <Input
                                autoFocus
                                list="discipline-suggestions"
                                placeholder="Folder name"
                                value={newFolderName}
                                onChange={(e) =>
                                    setNewFolderName(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (
                                        e.key === "Enter" &&
                                        newFolderName.trim()
                                    ) {
                                        addPendingFolder(
                                            newFolderName.trim()
                                        );
                                    }
                                    if (e.key === "Escape") {
                                        setShowNewFolder(false);
                                        setNewFolderName("");
                                    }
                                }}
                            />
                            <datalist id="discipline-suggestions">
                                {DISCIPLINES.map((discipline) => (
                                    <option
                                        key={discipline.id}
                                        value={discipline.id}
                                    >
                                        {discipline.name}
                                    </option>
                                ))}
                            </datalist>
                            <Button
                                variant="primary"
                                size="sm"
                                disabled={!newFolderName.trim()}
                                onClick={() =>
                                    addPendingFolder(newFolderName.trim())
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
                        <p className="text-xs text-muted-foreground pl-1">
                            Tip: name it after a discipline (
                            {DISCIPLINES.map((d) => d.id).join(", ")}) so its
                            IFC/TTL files show up in the Digital Twin viewer.
                        </p>
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
