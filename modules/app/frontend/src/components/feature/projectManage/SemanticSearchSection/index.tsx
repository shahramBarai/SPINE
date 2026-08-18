import { useState } from "react";
import { toast } from "react-toastify";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import {
    QueryEditor,
    ResultsPanel,
    type SemanticSearchExample
} from "components/complex/semanticSearch";
import { SavedQueriesBar } from "./SavedQueriesBar";

const DEFAULT_SPARQL_QUERY = `SELECT ?s ?p ?o
WHERE {
    ?s ?p ?o .
}
LIMIT 200`;

// Shown in the examples dropdown in place of the project's saved queries
// when it has none saved yet, so there's always at least one query to load.
const FALLBACK_EXAMPLE: SemanticSearchExample = {
    id: "all-triples",
    label: "All triples"
};

function SemanticSearchSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const [query, setQuery] = useState(DEFAULT_SPARQL_QUERY);
    const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
    const [selectedExampleId, setSelectedExampleId] = useState("");
    const [isLoadingExample, setIsLoadingExample] = useState(false);

    const {
        data: triples,
        isLoading,
        isError,
        error
    } = api.project.semanticSearch.runSemanticSearch.useQuery(
        { projectId, query: submittedQuery ?? "" },
        { enabled: submittedQuery !== null }
    );

    const { data: savedQueries } =
        api.project.semanticSearch.listSemanticSearchQueries.useQuery({
            projectId
        });
    const utils = api.useUtils();

    const examples: SemanticSearchExample[] =
        savedQueries && savedQueries.length > 0
            ? savedQueries.map((saved) => ({
                  id: saved.fileId,
                  label: saved.name
              }))
            : [FALLBACK_EXAMPLE];

    const runQuery = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        setSubmittedQuery(trimmed);
    };

    const handleSelectExample = async (exampleId: string) => {
        setSelectedExampleId(exampleId);

        // The fallback only ever appears when there are no saved queries to
        // look up, so resolve it locally instead of hitting the backend.
        if (exampleId === FALLBACK_EXAMPLE.id) {
            setQuery(DEFAULT_SPARQL_QUERY);
            return;
        }

        const saved = savedQueries?.find((entry) => entry.fileId === exampleId);
        if (!saved) return;

        setIsLoadingExample(true);
        try {
            const { query: text } =
                await utils.project.semanticSearch.getSemanticSearchQuery.fetch(
                    {
                        projectId,
                        fileId: saved.fileId
                    }
                );
            setQuery(text);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to load saved query"
            );
        } finally {
            setIsLoadingExample(false);
        }
    };

    return (
        <div className={cn("w-full flex flex-col gap-3", className)}>
            <SavedQueriesBar
                projectId={projectId}
                query={query}
                onSaved={setSelectedExampleId}
            />

            <QueryEditor
                query={query}
                onQueryChange={setQuery}
                onRun={runQuery}
                isLoading={isLoading}
                examples={examples}
                selectedExampleId={selectedExampleId}
                onSelectExample={handleSelectExample}
                isLoadingExample={isLoadingExample}
            />

            <ResultsPanel
                className="min-h-[480px]"
                triples={triples ?? []}
                isLoading={isLoading}
                isError={isError}
                errorMessage={error?.message}
                hasSearched={submittedQuery !== null}
            />
        </div>
    );
}

export { SemanticSearchSection };
