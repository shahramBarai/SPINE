import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import { cn } from "utils/index";
import { SectionCard } from "components/complex/SectionCard";
import { GraphView } from "./graph";
import { ResultsTable } from "./ResultsTable";
import { triplesToGraph } from "./triplesToGraph";
import { type Triple } from "../types";

type ResultsView = "table" | "graph";

const VIEWS: { id: ResultsView; label: string }[] = [
    { id: "table", label: "Table" },
    { id: "graph", label: "Graph" }
];

function ViewToggle({
    view,
    onChange
}: {
    view: ResultsView;
    onChange: (view: ResultsView) => void;
}) {
    return (
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {VIEWS.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange(option.id)}
                    aria-pressed={view === option.id}
                    className={cn(
                        "h-6 rounded px-2 text-xs font-medium transition-colors cursor-pointer",
                        view === option.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-primary"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/**
 * The result half of the semantic search UI: the same triples rendered
 * either as a table or as a graph, plus the shared empty/loading/error
 * states. Both views are derived client-side from the one query result -
 * switching between them never re-queries.
 */
function ResultsPanel({
    triples,
    isLoading,
    isError,
    errorMessage,
    hasSearched,
    className
}: {
    triples: Triple[];
    isLoading: boolean;
    isError: boolean;
    errorMessage?: string;
    hasSearched: boolean;
    className?: string;
}) {
    const [view, setView] = useState<ResultsView>("table");

    // GraphView seeds its layout from this object's identity, so it has to
    // stay stable across the re-renders that panning/selecting cause.
    const graphData = useMemo(() => triplesToGraph(triples), [triples]);

    return (
        <SectionCard
            title="Result"
            className={cn("flex-1 min-h-0 flex flex-col gap-2!", className)}
            action={<ViewToggle view={view} onChange={setView} />}
        >
            {!hasSearched ? (
                <div className="flex-1 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    Run a query to see matching triples.
                </div>
            ) : isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Running query...</span>
                </div>
            ) : isError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center text-danger">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                        {errorMessage || "Invalid or failed SPARQL query."}
                    </span>
                </div>
            ) : triples.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                    <SearchX className="h-4 w-4" />
                    <span className="text-sm">
                        No triples matched this query.
                    </span>
                </div>
            ) : (
                <div className="flex-1 min-h-0">
                    {view === "table" ? (
                        <ResultsTable triples={triples} />
                    ) : (
                        <GraphView graphData={graphData} />
                    )}
                </div>
            )}
        </SectionCard>
    );
}

export { ResultsPanel };
