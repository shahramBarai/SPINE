import { useRef } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "components/basics/Button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";
import { cn } from "utils/index";
import { SectionCard } from "components/complex/SectionCard";

type SemanticSearchExample = {
    id: string;
    label: string;
};

function QueryEditor({
    query,
    onQueryChange,
    onRun,
    isLoading,
    examples,
    selectedExampleId,
    onSelectExample,
    isLoadingExample,
    className
}: {
    query: string;
    onQueryChange: (query: string) => void;
    onRun: () => void;
    isLoading: boolean;
    examples: SemanticSearchExample[];
    selectedExampleId: string;
    onSelectExample: (exampleId: string) => void;
    // Whether the selected example's text is still being fetched (e.g. a
    // saved query being read back from storage), so the textarea can show
    // a loading state instead of appearing to just go blank/stale.
    isLoadingExample?: boolean;
    className?: string;
}) {
    const gutterRef = useRef<HTMLDivElement>(null);

    const lineCount = query.split("\n").length;

    // Line numbers are a separate element from the textarea, so keeping
    // them lined up with their actual rows means mirroring the textarea's
    // own scroll position - the gutter itself never scrolls independently.
    const syncGutterScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
        if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
        }
    };

    return (
        <SectionCard
            title="SPARQL query"
            className={cn("flex flex-col gap-1!", className)}
            action={
                <div className="flex items-center gap-2">
                    <Select
                        value={selectedExampleId}
                        onValueChange={onSelectExample}
                        disabled={isLoadingExample}
                    >
                        <SelectTrigger size="sm" className="w-[170px]">
                            <SelectValue placeholder="Examples" />
                        </SelectTrigger>
                        <SelectContent>
                            {examples.map((example) => (
                                <SelectItem key={example.id} value={example.id}>
                                    {example.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onRun}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Search className="h-4 w-4" />
                        )}
                        Run
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-1">
                <div
                    className={cn(
                        "relative flex-1 min-h-[120px] flex rounded-md border border-input bg-transparent shadow-xs",
                        "transition-[color,box-shadow]",
                        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
                    )}
                >
                    <div
                        ref={gutterRef}
                        aria-hidden="true"
                        className="w-9 shrink-0 overflow-hidden select-none py-2 text-right font-mono text-xs leading-relaxed text-muted-foreground border-r border-input"
                    >
                        {Array.from({ length: lineCount }, (_, index) => (
                            <div key={index} className="px-2">
                                {index + 1}
                            </div>
                        ))}
                    </div>
                    <textarea
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        onScroll={syncGutterScroll}
                        wrap="off"
                        readOnly={isLoadingExample}
                        className="flex-1 resize-none bg-transparent px-2 py-2 font-mono text-xs leading-relaxed outline-none"
                        placeholder="SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 200"
                        spellCheck={false}
                    />
                    {isLoadingExample && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-md bg-background/70 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading query...
                        </div>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    SELECT must return ?s ?p ?o (or ?subject ?predicate
                    ?object).
                </p>
            </div>
        </SectionCard>
    );
}

export { QueryEditor, type SemanticSearchExample };
