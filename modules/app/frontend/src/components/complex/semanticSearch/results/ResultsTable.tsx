import { cn } from "utils/index";
import { colorForType } from "utils/typeColors";
import { type Triple } from "../types";

function ResultsTable({ triples }: { triples: Triple[] }) {
    return (
        <div className="h-full min-h-0 overflow-auto border border-border rounded-lg">
            <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-muted-foreground text-left">
                    <tr>
                        <th className="px-3 py-2 font-medium w-10">#</th>
                        <th className="px-3 py-2 font-medium">Subject</th>
                        <th className="px-3 py-2 font-medium">Predicate</th>
                        <th className="px-3 py-2 font-medium">Object</th>
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
    );
}

export { ResultsTable };
