import { CloudSync, Loader } from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "utils/index";
import { api } from "utils/trpc";

interface SyncToFusekiButtonProps {
    projectId: string;
    disciplineId: string;
    fileId: string;
    fileName: string;
}

function SyncToFusekiButton({
    projectId,
    disciplineId,
    fileId,
    fileName
}: SyncToFusekiButtonProps) {
    const utils = api.useUtils();
    const syncMutation = api.digitalTwin.syncTtlToFuseki.useMutation();

    const handleSync = async () => {
        try {
            await syncMutation.mutateAsync({
                projectId,
                discipline: disciplineId,
                fileId,
                fileName
            });
            await utils.digitalTwin.getGraphTree.invalidate({
                projectId,
                discipline: disciplineId,
                fileId
            });
            toast.success(`${fileName} synced to Fuseki.`);
        } catch (error) {
            console.error(error);
            toast.error(`Failed to sync ${fileName} to Fuseki.`);
        }
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                handleSync();
            }}
            className={cn(
                "h-5 w-5 rounded flex items-center justify-center text-muted-foreground",
                syncMutation.isPending
                    ? "hover:cursor-not-allowed text-primary"
                    : "hover:cursor-pointer hover:text-primary hover:bg-primary/10 transition-all"
            )}
            disabled={syncMutation.isPending}
            aria-label={`Sync ${fileName} to Fuseki`}
            title="Sync to Fuseki"
        >
            {syncMutation.isPending ? (
                <Loader className="h-3 w-3 animate-spin" />
            ) : (
                <CloudSync className="h-3 w-3" />
            )}
        </button>
    );
}

export { SyncToFusekiButton };
