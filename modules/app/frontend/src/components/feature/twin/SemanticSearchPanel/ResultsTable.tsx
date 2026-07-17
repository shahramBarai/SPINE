import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import { cn } from "utils/index";
import { type Triple } from "./types/semanticSearch";
import { colorForType } from "../utils/typeColors";

function ResultsTable({
    triples,
    isLoading,
    isError,
    hasSearched,
    className
}: {
    triples: Triple[];
    isLoading: boolean;
    isError: boolean;
    hasSearched: boolean;
    className?: string;
}) {
    return (
        <section className={cn("min-h-0 flex flex-col", className)}>
            <div className="px-3 py-2 border-b border-border/40 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Result
            </div>

            {!hasSearched ? (
                <div className="flex-1 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
                    Run a query to see matching triples.
                </div>
            ) : isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs">Running query...</span>
                </div>
            ) : isError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs">
                        Invalid or failed SPARQL query.
                    </span>
                </div>
            ) : triples.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                    <SearchX className="h-4 w-4" />
                    <span className="text-xs">
                        No triples matched this query.
                    </span>
                </div>
            ) : (
                <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-xs font-mono">
                        <thead className="sticky top-0 bg-card/95 backdrop-blur z-10">
                            <tr className="border-b border-border/60">
                                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium w-10">
                                    #
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                                    Subject
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                                    Predicate
                                </th>
                                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                                    Object
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {triples.map((triple, index) => (
                                <tr
                                    key={index}
                                    className="border-b border-border/30 hover:bg-accent/30"
                                >
                                    <td className="px-3 py-2 text-muted-foreground">
                                        {String(index + 1).padStart(3, "0")}
                                    </td>
                                    <td
                                        className={cn(
                                            "px-3 py-2",
                                            colorForType(triple.subject)
                                                .text
                                        )}
                                    >
                                        {triple.subject}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                        {triple.predicate}
                                    </td>
                                    <td
                                        className={cn(
                                            "px-3 py-2",
                                            colorForType(triple.object)
                                                .text
                                        )}
                                    >
                                        {triple.object}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

export { ResultsTable };
