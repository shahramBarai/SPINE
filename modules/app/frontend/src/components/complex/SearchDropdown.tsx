import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "components/basics/input";
import { cn } from "utils/index";

// A search-and-pick overlay: a search input plus a results dropdown,
// floating above every other layer of the UI (including other modals).
// It owns none of the data fetching - the caller supplies `query`,
// `results`, and `isLoading`, so this stays a pure presentation piece
// that can be reused for any "search then pick one" flow.
function SearchDropdown<T>({
    open,
    onClose,
    query,
    onQueryChange,
    results,
    isLoading = false,
    onSelect,
    getKey,
    renderResult,
    placeholder = "Search...",
    emptyMessage = "No results found."
}: {
    open: boolean;
    onClose: () => void;
    query: string;
    onQueryChange: (query: string) => void;
    results: T[];
    isLoading?: boolean;
    onSelect: (result: T) => void;
    getKey: (result: T) => string;
    renderResult: (result: T) => React.ReactNode;
    placeholder?: string;
    emptyMessage?: string;
}) {
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-60 flex justify-center bg-foreground/20 pt-8"
            onClick={onClose}
        >
            <div
                className="h-fit w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <Input
                    className="bg-background!"
                    autoFocus
                    placeholder={placeholder}
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                />

                {query.trim().length !== 0 && (
                    <div className="mt-1 max-h-72 overflow-y-auto rounded-b-lg bg-background">
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Searching...
                            </div>
                        ) : results.length > 0 ? (
                            results.map((result) => (
                                <button
                                    type="button"
                                    key={getKey(result)}
                                    onClick={() => onSelect(result)}
                                    className={cn(
                                        "w-full border-b border-border px-3 py-2 text-left text-sm",
                                        "hover:cursor-pointer hover:bg-muted"
                                    )}
                                >
                                    {renderResult(result)}
                                </button>
                            ))
                        ) : (
                            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export { SearchDropdown };
