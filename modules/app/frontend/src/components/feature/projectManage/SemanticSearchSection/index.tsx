import { useState } from "react";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import { QueryEditor } from "components/complex/semanticSearch/QueryEditor";
import { ResultsTable } from "components/complex/semanticSearch/ResultsTable";
import {
    DEFAULT_SPARQL_QUERY,
    SEMANTIC_SEARCH_EXAMPLES
} from "./utils/semanticSearchExamples";
import { SavedQueriesBar } from "./SavedQueriesBar";

function SemanticSearchSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const [query, setQuery] = useState(DEFAULT_SPARQL_QUERY);
    const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

    const {
        data: triples,
        isLoading,
        isError,
        error
    } = api.project.runSemanticSearch.useQuery(
        { projectId, query: submittedQuery ?? "" },
        { enabled: submittedQuery !== null }
    );

    const runQuery = () => {
        const trimmed = query.trim();
        if (!trimmed) return;
        setSubmittedQuery(trimmed);
    };

    return (
        <div className={cn("w-full flex flex-col gap-3", className)}>
            <SavedQueriesBar query={query} />

            <QueryEditor
                query={query}
                onQueryChange={setQuery}
                onRun={runQuery}
                isLoading={isLoading}
                examples={SEMANTIC_SEARCH_EXAMPLES}
            />

            <ResultsTable
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
