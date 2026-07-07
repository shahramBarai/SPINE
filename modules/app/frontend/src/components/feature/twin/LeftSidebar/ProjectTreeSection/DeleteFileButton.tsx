import { X } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "utils/index";
import { api } from "utils/trpc";

interface DeleteFileButtonProps {
    projectId: string;
    disciplineId: string;
    fileId: string;
    fileName: string;
}

function DeleteFileButton({
    projectId,
    disciplineId,
    fileId,
    fileName
}: DeleteFileButtonProps) {
    const utils = api.useUtils();

    const deleteFileMutation = api.digitalTwin.deleteProjectFile.useMutation();

    const handleDeleteFile = async () => {
        try {
            await deleteFileMutation.mutateAsync({
                projectId,
                discipline: disciplineId,
                fileId,
                fileName
            });
            await utils.digitalTwin.getProjectFilesInfo.invalidate({
                projectId,
                discipline: disciplineId
            });
            toast.success(`${fileName} removed from storage.`);
        } catch (error) {
            console.error(error);
            toast.error(`Failed to remove ${fileName}.`);
        }
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                handleDeleteFile();
            }}
            className={cn(
                "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                "hover:cursor-pointer hover:text-danger hover:bg-danger/10 transition-all"
            )}
            disabled={deleteFileMutation.isPending}
        >
            <X className="h-3 w-3" />
        </button>
    );
}

export { DeleteFileButton };
