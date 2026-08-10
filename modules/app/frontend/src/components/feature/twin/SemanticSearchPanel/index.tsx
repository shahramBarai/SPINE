import { useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Database,
    Maximize2,
    Minimize2
} from "lucide-react";
import { cn } from "utils/index";
import { api } from "utils/trpc";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import {
    QueryEditor,
    ResultsPanel,
    type SemanticSearchExample
} from "components/complex/semanticSearch";

export const DEFAULT_SPARQL_QUERY = `SELECT ?s ?p ?o
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

function SemanticSearchPanel({
    maximized,
    onToggleMaximize,
    collapsed,
    onToggleCollapsed,
    hidden
}: {
    maximized: boolean;
    onToggleMaximize: () => void;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    hidden?: boolean;
}) {
    const { projectInfo } = useDigitalTwin();
    const [query, setQuery] = useState(DEFAULT_SPARQL_QUERY);
    const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);
    const [selectedExampleId, setSelectedExampleId] = useState("");
    const [isLoadingExample, setIsLoadingExample] = useState(false);

    const {
        data: triples,
        isLoading,
        isError,
        error
    } = api.digitalTwin.runSemanticSearch.useQuery(
        { projectId: projectInfo.id, query: submittedQuery ?? "" },
        { enabled: submittedQuery !== null && query !== null }
    );

    const { data: savedQueries } =
        api.digitalTwin.listSemanticSearchQueries.useQuery({
            projectId: projectInfo.id
        });
    const utils = api.useUtils();

    const examples: SemanticSearchExample[] =
        savedQueries && savedQueries.length > 0
            ? savedQueries.map((saved) => ({
                  id: saved.fileId,
                  label: saved.name
              }))
            : [FALLBACK_EXAMPLE];

    const runSearch = () => {
        const trimmed = query.trim();
        if (!trimmed) {
            return;
        }
        setSubmittedQuery(trimmed);
    };

    const selectExample = async (exampleId: string) => {
        setSelectedExampleId(exampleId);

        // The fallback only ever appears when there are no saved queries to
        // look up, so resolve it locally instead of hitting the backend.
        if (exampleId === FALLBACK_EXAMPLE.id) {
            setQuery(DEFAULT_SPARQL_QUERY);
            return;
        }

        setIsLoadingExample(true);
        try {
            const { query: text } =
                await utils.digitalTwin.getSemanticSearchQuery.fetch({
                    projectId: projectInfo.id,
                    fileId: exampleId
                });
            setQuery(text);
        } catch {
            // A saved query becoming unreadable mid-session (deleted, MinIO
            // hiccup) shouldn't crash the panel - the dropdown selection
            // just doesn't load new text, leaving whatever was there before.
        } finally {
            setIsLoadingExample(false);
        }
    };

    return (
        <section
            className={cn(
                "h-full min-w-0 flex flex-col rounded-lg border border-border/60 bg-card/40 overflow-hidden",
                hidden ? "hidden" : ""
            )}
            aria-label="Semantic Search"
            aria-hidden={hidden}
        >
            <header className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-border/60">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-mono text-muted-foreground">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    Semantic Search
                    {triples && (
                        <span className="normal-case tracking-normal text-[10px] font-mono text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded">
                            {triples.length} triples
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onToggleCollapsed}
                        className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-primary"
                        title={collapsed ? "Expand" : "Collapse"}
                    >
                        {collapsed ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                        )}
                    </button>
                    <button
                        onClick={onToggleMaximize}
                        className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-primary"
                        title={maximized ? "Restore" : "Maximize"}
                    >
                        {maximized ? (
                            <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                            <Maximize2 className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </header>

            {!collapsed && (
                <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0">
                    <QueryEditor
                        className="border-r border-border/40 p-3"
                        query={query}
                        onQueryChange={setQuery}
                        onRun={runSearch}
                        isLoading={isLoading}
                        examples={examples}
                        selectedExampleId={selectedExampleId}
                        onSelectExample={(id) => void selectExample(id)}
                        isLoadingExample={isLoadingExample}
                    />
                    <ResultsPanel
                        className="p-3"
                        triples={triples ?? []}
                        isLoading={isLoading}
                        isError={isError}
                        errorMessage={error?.message}
                        hasSearched={submittedQuery !== null}
                    />
                </div>
            )}
        </section>
    );
}

export { SemanticSearchPanel };
