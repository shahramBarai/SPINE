import { type GraphNode } from "./types/graph";
import { colorForNodeType } from "./utils/nodeTypeColors";
import { cn } from "utils/index";

// Shows the distinct node types actually present on the canvas, each with
// the same fill color as its nodes - so it doubles as a key for
// colorForNodeType's groups.
function GraphLegend({ nodes }: { nodes: GraphNode[] }) {
    const types = Array.from(new Set(nodes.map((n) => n.type))).sort();

    if (!types.length) {
        return null;
    }

    return (
        <div
            className={cn(
                "absolute bottom-3 left-3 z-20 max-w-[80%]",
                "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2",
                "rounded-md bg-surface text-surface-foreground",
                "border border-border/60",
                "text-[10px] font-mono"
            )}
        >
            {types.map((type) => (
                <span key={type} className="flex items-center gap-1.5">
                    <svg width={8} height={8} className="shrink-0">
                        <circle
                            cx={4}
                            cy={4}
                            r={4}
                            className={colorForNodeType(type).fill}
                        />
                    </svg>
                    {type}
                </span>
            ))}
        </div>
    );
}

export { GraphLegend };
