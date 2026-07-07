import { DatabaseX, Loader } from "lucide-react";
import { api } from "utils/trpc";
import { FusekiTreeNode } from "./FusekiTreeNode";

function FusekiTreeSection({
    projectId,
    disciplineId,
    fileId
}: {
    projectId: string;
    disciplineId: string;
    fileId: string;
}) {
    const {
        data: tree,
        isLoading,
        isError
    } = api.digitalTwin.getGraphTree.useQuery({
        projectId,
        discipline: disciplineId,
        fileId
    });

    if (isLoading) {
        return (
            <div className="ml-4 mr-1 mb-1 flex items-center justify-center py-1.5 rounded border border-border/40 bg-background/30">
                <Loader className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            </div>
        );
    }

    if (!tree || isError) {
        return (
            <div className="ml-4 mr-1 mb-1 flex items-center justify-center gap-2 py-1.5 rounded border border-border/40 bg-background/30">
                <DatabaseX className="h-3.5 w-3.5 text-danger" />
                <span className="text-[10px] text-danger">
                    Error loading Fuseki graph.
                </span>
            </div>
        );
    }

    return (
        <div className="ml-4 mr-1 mb-1 rounded border border-border/40 bg-background/30 p-1">
            {tree.length === 0 ? (
                <div className="px-2 py-1 text-[10px] text-muted-foreground">
                    No graph data found. Sync this file to Fuseki first.
                </div>
            ) : (
                tree.map((node) => (
                    <FusekiTreeNode key={node.id} node={node} depth={0} />
                ))
            )}
        </div>
    );
}

export { FusekiTreeSection };
