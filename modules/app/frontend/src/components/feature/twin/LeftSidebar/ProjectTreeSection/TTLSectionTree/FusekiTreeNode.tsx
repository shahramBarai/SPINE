import { useState } from "react";
import { ChevronRight, Box } from "lucide-react";
import { cn } from "utils/index";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { FocusButton } from "../../../FocusButton";

interface FusekiTreeNodeData {
    id: string;
    label?: string;
    type: string;
    children: FusekiTreeNodeData[];
}

function FusekiTreeNode({
    node,
    depth
}: {
    node: FusekiTreeNodeData;
    depth: number;
}) {
    const [expanded, setExpanded] = useState<boolean>(depth < 1);
    const { selectedObjectIds, selectObject } = useDigitalTwin();
    const hasChildren = node.children.length > 0;
    const isSelected = selectedObjectIds.includes(node.id);

    return (
        <div>
            <div
                className={cn(
                    "flex items-center rounded",
                    isSelected
                        ? "bg-primary/15 text-primary"
                        : "hover:bg-accent/60 text-foreground/80"
                )}
                style={{ paddingLeft: `${depth * 12}px` }}
            >
                {hasChildren ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((prev) => !prev);
                        }}
                        className="h-5 w-5 shrink-0 flex items-center justify-center hover:cursor-pointer"
                        aria-label={expanded ? "Collapse" : "Expand"}
                    >
                        <ChevronRight
                            className={cn(
                                "h-3 w-3 transition-transform",
                                expanded && "rotate-90"
                            )}
                        />
                    </button>
                ) : (
                    <span className="h-5 w-5 shrink-0" />
                )}

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        selectObject(node.id);
                    }}
                    className="flex-1 flex items-center gap-1 min-w-0 px-1 py-1 text-left text-[10px] font-mono hover:cursor-pointer"
                >
                    {!hasChildren && (
                        <Box className="h-3 w-3 shrink-0 opacity-50" />
                    )}
                    <span className="truncate">{node.label || node.id}</span>
                    <span className="ml-auto pl-1 text-[9px] text-muted-foreground shrink-0">
                        {node.type}
                    </span>
                </button>

                <FocusButton nodeId={node.id} className="shrink-0" />
            </div>

            {expanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <FusekiTreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export { FusekiTreeNode };
export type { FusekiTreeNodeData };
