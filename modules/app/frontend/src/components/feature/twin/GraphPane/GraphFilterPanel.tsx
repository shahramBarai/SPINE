import { X } from "lucide-react";
import { colorForType } from "../utils/typeColors";
import { DEFAULT_EXCLUDED_NODE_TYPES } from "./types/graph";
import { cn } from "utils/index";

// An unchecked-nothing-yet selection ("null" or empty Set) displays as
// fully checked, matching the "empty selection = show everything" semantics
// in useGraphTypeFilter - so the panel opens looking like nothing is being
// filtered out, rather than an ambiguous blank state.
function GraphFilterPanel({
    className,
    nodeTypes,
    predicates,
    selectedNodeTypes,
    selectedPredicates,
    onToggleNodeType,
    onTogglePredicate,
    showBulkNodeTypes,
    onToggleBulkNodeTypes,
    onClose
}: {
    className?: string;
    nodeTypes: string[];
    predicates: string[];
    selectedNodeTypes: Set<string> | null;
    selectedPredicates: Set<string> | null;
    onToggleNodeType: (type: string) => void;
    onTogglePredicate: (predicate: string) => void;
    showBulkNodeTypes: boolean;
    onToggleBulkNodeTypes: () => void;
    onClose: () => void;
}) {
    const isNodeTypeChecked = (type: string) =>
        !selectedNodeTypes ||
        selectedNodeTypes.size === 0 ||
        selectedNodeTypes.has(type);
    const isPredicateChecked = (predicate: string) =>
        !selectedPredicates ||
        selectedPredicates.size === 0 ||
        selectedPredicates.has(predicate);

    return (
        <div
            className={cn(
                "w-56 overflow-hidden rounded-md border border-border/60",
                "bg-background/90 shadow-elevated backdrop-blur-md",
                className
            )}
        >
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                    Filters
                </span>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                    aria-label="Close filters"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="max-h-64 space-y-3 overflow-auto px-3 py-2">
                <div>
                    <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
                        Bulk Data
                    </div>
                    <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-surface-foreground">
                        <input
                            type="checkbox"
                            checked={showBulkNodeTypes}
                            onChange={onToggleBulkNodeTypes}
                            className="h-3 w-3"
                        />
                        Include {DEFAULT_EXCLUDED_NODE_TYPES.join(", ")} (can be
                        thousands of nodes)
                    </label>
                </div>

                {nodeTypes.length > 0 && (
                    <div>
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
                            Node Types
                        </div>
                        <div className="space-y-1">
                            {nodeTypes.map((type) => (
                                <label
                                    key={type}
                                    className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-surface-foreground"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isNodeTypeChecked(type)}
                                        onChange={() => onToggleNodeType(type)}
                                        className="h-3 w-3"
                                    />
                                    <svg
                                        width={8}
                                        height={8}
                                        className="shrink-0"
                                    >
                                        <circle
                                            cx={4}
                                            cy={4}
                                            r={4}
                                            className={colorForType(type).fill}
                                        />
                                    </svg>
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {predicates.length > 0 && (
                    <div>
                        <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.1em] text-muted-foreground">
                            Relations
                        </div>
                        <div className="space-y-1">
                            {predicates.map((predicate) => (
                                <label
                                    key={predicate}
                                    className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-surface-foreground"
                                >
                                    <input
                                        type="checkbox"
                                        checked={isPredicateChecked(predicate)}
                                        onChange={() =>
                                            onTogglePredicate(predicate)
                                        }
                                        className="h-3 w-3"
                                    />
                                    {predicate}
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export { GraphFilterPanel };
