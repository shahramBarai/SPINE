import { useState } from "react";
import {
    ChevronDown,
    ChevronUp,
    Database,
    Maximize2,
    Minimize2
} from "lucide-react";
import { cn } from "utils/index";
import { QueryEditor } from "components/complex/semanticSearch/QueryEditor";
import { ResultsTable } from "components/complex/semanticSearch/ResultsTable";
import { useSemanticSearch } from "./hooks/useSemanticSearch";
import {
    DEFAULT_SPARQL_QUERY,
    SEMANTIC_SEARCH_EXAMPLES
} from "./utils/semanticSearchExamples";

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
    const [query, setQuery] = useState(DEFAULT_SPARQL_QUERY);
    const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

    const {
        data: triples,
        isLoading,
        isError
    } = useSemanticSearch({
        query: submittedQuery,
        enabled: submittedQuery !== null
    });

    const runSearch = () => {
        const trimmed = query.trim();
        if (!trimmed) {
            return;
        }
        setSubmittedQuery(trimmed);
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
                        className="border-r border-border/40"
                        query={query}
                        onQueryChange={setQuery}
                        onRun={runSearch}
                        isLoading={isLoading}
                        examples={SEMANTIC_SEARCH_EXAMPLES}
                    />
                    <ResultsTable
                        triples={triples ?? []}
                        isLoading={isLoading}
                        isError={isError}
                        hasSearched={submittedQuery !== null}
                    />
                </div>
            )}
        </section>
    );
}

export { SemanticSearchPanel };
