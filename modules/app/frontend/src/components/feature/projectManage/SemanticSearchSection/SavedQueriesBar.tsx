import { useState } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { SectionCard } from "components/complex/SectionCard";
import { api } from "utils/trpc";
import { cn } from "utils/index";

// Mirrors the name rule enforced by project.saveSemanticSearchQuery on the
// backend, so an invalid name is caught before the round trip instead of
// only after a failed mutation.
const QUERY_NAME_REGEX = /^[a-zA-Z0-9 _-]+$/;

function SavedQueriesBar({
    projectId,
    query,
    onSaved,
    className
}: {
    projectId: string;
    query: string;
    onSaved: (fileId: string) => void;
    className?: string;
}) {
    const [saveName, setSaveName] = useState("");
    const utils = api.useUtils();

    const saveQuery =
        api.project.semanticSearch.saveSemanticSearchQuery.useMutation({
            onSuccess: (result, variables) => {
                setSaveName("");
                toast.success(`Query "${variables.name}" saved.`);
                utils.project.semanticSearch.listSemanticSearchQueries.invalidate(
                    { projectId }
                );
                onSaved(result.fileId);
            },
            onError: (error) => toast.error(error.message)
        });

    const handleSave = () => {
        const name = saveName.trim();
        if (!name) {
            toast.warning("Enter a name for this query.");
            return;
        }
        if (!QUERY_NAME_REGEX.test(name)) {
            toast.warning(
                "Query name can only contain letters, numbers, spaces, hyphens, and underscores."
            );
            return;
        }
        if (!query.trim()) {
            toast.warning("Write a query before saving it.");
            return;
        }

        saveQuery.mutate({ projectId, name, query });
    };

    return (
        <SectionCard
            title="Save current query as"
            className={cn("gap-2!", className)}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Query name"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleSave();
                        }}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSave}
                        disabled={saveQuery.isPending}
                    >
                        <Bookmark className="h-4 w-4" />
                        Save query
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
}

export { SavedQueriesBar };
