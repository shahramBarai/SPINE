import { useState } from "react";
import {
    Database,
    Pencil,
    Trash2,
    Check,
    X,
    Loader2,
    Upload
} from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { SectionCard } from "components/complex/SectionCard";
import { ConfirmModal } from "components/complex/ConfirmModal";
import { UploadTtlToGraphModal } from "../modals/UploadTtlToGraphModal";
import { cn } from "utils/index";

const DEFAULT_GRAPH_URI = "default";
const GRAPH_PAGE_SIZE = 5;

function FusekiGraphsSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const utils = api.useUtils();
    const {
        data: graphs,
        isLoading,
        error
    } = api.project.listGraphs.useQuery({ projectId });

    const [showAddGraph, setShowAddGraph] = useState(false);
    const [newGraphUri, setNewGraphUri] = useState("");
    const [editingUri, setEditingUri] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(GRAPH_PAGE_SIZE);

    const invalidateGraphs = () =>
        utils.project.listGraphs.invalidate({ projectId });

    const createGraph = api.project.createGraph.useMutation({
        onSuccess: (result) => {
            invalidateGraphs();
            setNewGraphUri("");
            setShowAddGraph(false);
            toast.success(`Graph "${result.graphUri}" created.`);
        },
        onError: (err) => toast.error(err.message)
    });

    const renameGraph = api.project.renameGraph.useMutation({
        onSuccess: () => {
            invalidateGraphs();
            setEditingUri(null);
            toast.success("Graph renamed.");
        },
        onError: (err) => toast.error(err.message)
    });

    const deleteGraph = api.project.deleteGraph.useMutation({
        onSuccess: () => {
            invalidateGraphs();
            setDeleteTarget(null);
            toast.success("Graph deleted.");
        },
        onError: (err) => toast.error(err.message)
    });

    const startEdit = (uri: string) => {
        setEditingUri(uri);
        setEditValue(uri);
    };

    const commitEdit = () => {
        if (!editingUri) return;
        const newUri = editValue.trim();
        if (!newUri) {
            toast.warning("Graph URI cannot be empty.");
            return;
        }
        if (newUri !== editingUri && graphs?.some((g) => g.uri === newUri)) {
            toast.warning("A graph with that URI already exists.");
            return;
        }
        renameGraph.mutate({ projectId, oldUri: editingUri, newUri });
    };

    const handleAdd = () => {
        const uri = newGraphUri.trim();
        if (!uri) {
            toast.warning("Enter a graph URI.");
            return;
        }
        if (graphs?.some((graph) => graph.uri === uri)) {
            toast.warning("A graph with that URI already exists.");
            return;
        }
        createGraph.mutate({ projectId, graphUri: uri });
    };

    if (isLoading) {
        return (
            <SectionCard title="Fuseki Graphs" className={className}>
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading graphs...
                </div>
            </SectionCard>
        );
    }

    if (error || !graphs) {
        return (
            <SectionCard title="Fuseki Graphs" className={className}>
                <p className="text-danger text-sm py-6">
                    Failed to load Fuseki graphs.
                </p>
            </SectionCard>
        );
    }

    const visibleGraphs = graphs.slice(0, visibleCount);
    const remainingCount = graphs.length - visibleGraphs.length;

    return (
        <SectionCard
            title="Fuseki Graphs"
            className={className}
            action={
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadModalOpen(true)}
                >
                    <Upload className="h-4 w-4" />
                    Upload TTL
                </Button>
            }
        >
            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {visibleGraphs.map((graph) => {
                    const isDefault = graph.uri === DEFAULT_GRAPH_URI;
                    return (
                        <div
                            key={graph.uri}
                            className="flex items-center gap-2 px-3 py-2 text-sm"
                        >
                            <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                            {editingUri === graph.uri ? (
                                <>
                                    <Input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) =>
                                            setEditValue(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") commitEdit();
                                            if (e.key === "Escape")
                                                setEditingUri(null);
                                        }}
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Save"
                                        disabled={renameGraph.isPending}
                                        onClick={commitEdit}
                                    >
                                        <Check className="h-4 w-4 text-success" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        title="Cancel"
                                        onClick={() => setEditingUri(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 truncate text-foreground font-mono text-xs">
                                        {graph.uri}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {graph.count} triples
                                    </span>
                                    {isDefault ? (
                                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                            Default
                                        </span>
                                    ) : (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Rename graph"
                                                onClick={() =>
                                                    startEdit(graph.uri)
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Delete graph"
                                                onClick={() =>
                                                    setDeleteTarget(graph.uri)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4 text-danger" />
                                            </Button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}

                {remainingCount > 0 ? (
                    <button
                        type="button"
                        onClick={() =>
                            setVisibleCount((prev) => prev + GRAPH_PAGE_SIZE)
                        }
                        className={cn(
                            "w-full py-2 text-center text-sm text-muted-foreground transition-colors",
                            "border-t border-dashed border-border",
                            "hover:cursor-pointer hover:text-primary hover:bg-muted"
                        )}
                    >
                        Show {Math.min(GRAPH_PAGE_SIZE, remainingCount)} more
                    </button>
                ) : showAddGraph ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                        <Input
                            autoFocus
                            placeholder="e.g. urn:spine:my-project:model-1"
                            value={newGraphUri}
                            onChange={(e) => setNewGraphUri(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAdd();
                                if (e.key === "Escape") {
                                    setShowAddGraph(false);
                                    setNewGraphUri("");
                                }
                            }}
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={createGraph.isPending}
                            onClick={handleAdd}
                        >
                            Create
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowAddGraph(false);
                                setNewGraphUri("");
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAddGraph(true)}
                        className={cn(
                            "w-full py-2 text-center text-sm text-muted-foreground transition-colors",
                            "hover:cursor-pointer hover:text-primary hover:bg-muted "
                        )}
                    >
                        + New graph
                    </button>
                )}
            </div>

            {deleteTarget && (
                <ConfirmModal
                    title="Delete graph"
                    description={`Are you sure you want to delete "${deleteTarget}"? This action cannot be undone.`}
                    open={!!deleteTarget}
                    setOpen={(open) => {
                        if (!open) setDeleteTarget(null);
                    }}
                    isConfirming={deleteGraph.isPending}
                    onConfirm={() =>
                        deleteGraph.mutate({
                            projectId,
                            graphUri: deleteTarget
                        })
                    }
                />
            )}

            {uploadModalOpen && (
                <UploadTtlToGraphModal
                    projectId={projectId}
                    existingGraphs={graphs}
                    open={uploadModalOpen}
                    setOpen={setUploadModalOpen}
                    onSuccess={invalidateGraphs}
                />
            )}
        </SectionCard>
    );
}

export { FusekiGraphsSection };
