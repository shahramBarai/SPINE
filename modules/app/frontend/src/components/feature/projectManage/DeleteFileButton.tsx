import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import { ConfirmModal } from "components/complex/ConfirmModal";

interface DeleteFileButtonProps {
    projectId: string;
    folder: string;
    fileId: string;
    fileName: string;
    onSuccess?: () => void;
}

function DeleteFileButton({
    projectId,
    folder,
    fileId,
    fileName,
    onSuccess
}: DeleteFileButtonProps) {
    const [open, setOpen] = useState(false);

    const deleteFile = api.project.deleteFile.useMutation({
        onSuccess: () => {
            setOpen(false);
            onSuccess?.();
            toast.success(`${fileName} deleted.`);
        },
        onError: (err) => toast.error(err.message)
    });

    return (
        <>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(true);
                }}
                className={cn(
                    "h-5 w-5 rounded flex items-center justify-center text-danger",
                    "hover:cursor-pointer hover:bg-danger/10 transition-all"
                )}
            >
                <Trash2 className="h-3 w-3" />
            </button>

            {open && (
                <ConfirmModal
                    title="Delete file"
                    description={`Are you sure you want to delete "${fileName}"? This action cannot be undone.`}
                    open={open}
                    setOpen={setOpen}
                    isConfirming={deleteFile.isPending}
                    onConfirm={() =>
                        deleteFile.mutate({
                            projectId,
                            folder,
                            fileId,
                            fileName
                        })
                    }
                />
            )}
        </>
    );
}

export { DeleteFileButton };
