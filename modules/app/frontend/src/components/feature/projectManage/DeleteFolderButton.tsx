import { useState } from "react";
import { Trash2, File } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { ConfirmModal } from "components/complex/ConfirmModal";

interface DeleteFolderButtonProps {
    projectId: string;
    folder: string;
    fileNames: string[];
    onSuccess?: () => void;
}

function DeleteFolderButton({
    projectId,
    folder,
    fileNames,
    onSuccess
}: DeleteFolderButtonProps) {
    const [open, setOpen] = useState(false);

    const deleteFolder = api.project.deleteFolder.useMutation({
        onSuccess: () => {
            setOpen(false);
            onSuccess?.();
            toast.success(`"${folder}" deleted.`);
        },
        onError: (err) => toast.error(err.message)
    });

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                title="Delete folder"
                onClick={() => setOpen(true)}
            >
                <Trash2 className="h-4 w-4 text-danger" />
            </Button>

            {open && (
                <ConfirmModal
                    title={`Delete "${folder}"`}
                    description={
                        fileNames.length === 0
                            ? "This folder is empty. It will be deleted."
                            : `This will also delete the following ${fileNames.length} file${fileNames.length === 1 ? "" : "s"}:`
                    }
                    open={open}
                    setOpen={setOpen}
                    isConfirming={deleteFolder.isPending}
                    onConfirm={() =>
                        deleteFolder.mutate({ projectId, folder })
                    }
                >
                    {fileNames.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                            {fileNames.map((fileName) => (
                                <div
                                    key={fileName}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm border-b border-border last:border-b-0"
                                >
                                    <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate text-foreground">
                                        {fileName}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </ConfirmModal>
            )}
        </>
    );
}

export { DeleteFolderButton };
