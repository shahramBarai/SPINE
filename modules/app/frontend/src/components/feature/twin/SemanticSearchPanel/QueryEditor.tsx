import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";
import { cn } from "utils/index";
import { SEMANTIC_SEARCH_EXAMPLES } from "./utils/semanticSearchExamples";

function QueryEditor({
    query,
    onQueryChange,
    onRun,
    isLoading,
    className
}: {
    query: string;
    onQueryChange: (query: string) => void;
    onRun: () => void;
    isLoading: boolean;
    className?: string;
}) {
    const [selectedExampleId, setSelectedExampleId] = useState("all-triples");

    const applyExample = (exampleId: string) => {
        setSelectedExampleId(exampleId);
        const example = SEMANTIC_SEARCH_EXAMPLES.find(
            (entry) => entry.id === exampleId
        );
        if (example) {
            onQueryChange(example.query);
        }
    };

    return (
        <section className={cn("p-3 min-h-0 flex flex-col gap-2", className)}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    Query
                </h3>
                <div className="flex items-center gap-2">
                    <Select
                        value={selectedExampleId}
                        onValueChange={applyExample}
                    >
                        <SelectTrigger
                            size="sm"
                            className="h-7 w-[170px] text-[11px] font-mono"
                        >
                            <SelectValue placeholder="Examples" />
                        </SelectTrigger>
                        <SelectContent>
                            {SEMANTIC_SEARCH_EXAMPLES.map((example) => (
                                <SelectItem key={example.id} value={example.id}>
                                    {example.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <button
                        onClick={onRun}
                        disabled={isLoading}
                        className={cn(
                            "h-7 px-2.5 rounded flex items-center gap-1.5",
                            "bg-primary text-primary-foreground text-xs font-mono",
                            "hover:cursor-pointer disabled:cursor-default",
                            "hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Search className="h-3.5 w-3.5" />
                        )}
                        Run
                    </button>
                </div>
            </div>

            <textarea
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                className={cn(
                    "flex-1 min-h-[120px] resize-none rounded",
                    "bg-background/70 border border-border/60",
                    "font-mono text-xs leading-relaxed p-2",
                    "outline-none focus:border-primary/50"
                )}
                placeholder="SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 200"
                spellCheck={false}
            />
            <p className="text-[10px] font-mono text-muted-foreground">
                SELECT must return ?s ?p ?o (or ?subject ?predicate ?object).
                CONSTRUCT is also supported.
            </p>
        </section>
    );
}

export { QueryEditor };
