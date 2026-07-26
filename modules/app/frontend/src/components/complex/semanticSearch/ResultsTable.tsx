import { AlertTriangle, Loader2, SearchX } from "lucide-react";
import { cn } from "utils/index";
import { SectionCard } from "components/complex/SectionCard";
import { colorForType } from "components/feature/twin/utils/typeColors";

type Triple = {
    subject: string;
    predicate: string;
    object: string;
};

function ResultsTable({
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
    return (
        <SectionCard
            title="Result"
            className={cn("flex-1 min-h-0 flex flex-col gap-2!", className)}
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
                <div className="flex-1 min-h-0 overflow-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted text-muted-foreground text-left">
                            <tr>
                                <th className="px-3 py-2 font-medium w-10">
                                    #
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    Subject
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    Predicate
                                </th>
                                <th className="px-3 py-2 font-medium">
                                    Object
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {triples.map((triple, index) => (
                                <tr
                                    key={index}
                                    className="border-t border-border hover:bg-muted/50"
                                >
                                    <td className="px-3 py-2 text-muted-foreground">
                                        {index + 1}
                                    </td>
                                    <td
                                        className={cn(
                                            "px-3 py-2",
                                            colorForType(triple.subject).text
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
                                            colorForType(triple.object).text
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
        </SectionCard>
    );
}

export { ResultsTable, type Triple };
