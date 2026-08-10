import {
    VIEW_CENTER_X,
    VIEW_CENTER_Y,
    VIEW_HEIGHT,
    VIEW_WIDTH,
    type GraphEdge,
    type NodeState
} from "./types";
import { type useGraphViewport } from "./hooks/useGraphViewport";
import { curvedEdgePath, edgeKey } from "./utils/graphLayout";
import { colorForType } from "utils/typeColors";
import { cn } from "utils/index";

// Pure renderer for the pannable/zoomable SVG scene: it draws whatever the
// caller says is visible and reports clicks back, but owns no graph state
// of its own (see GraphView for layout, filtering and selection).
function GraphCanvas({
    nodes,
    edges,
    visibleNodeIds,
    visibleEdgeKeys,
    selectedNodeId,
    onSelectNode,
    viewport
}: {
    nodes: NodeState[];
    edges: GraphEdge[];
    visibleNodeIds: Set<string>;
    visibleEdgeKeys: Set<string>;
    selectedNodeId: string | null;
    onSelectNode: (nodeId: string) => void;
    viewport: ReturnType<typeof useGraphViewport>;
}) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return (
        <svg
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="w-full h-full"
            onWheel={viewport.onWheel}
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={viewport.onPointerDownBackground}
            onPointerMove={viewport.onPointerMove}
            onPointerUp={viewport.onPointerUp}
            onPointerCancel={viewport.onPointerUp}
        >
            <g
                transform={`translate(${viewport.pan.x} ${viewport.pan.y}) translate(${VIEW_CENTER_X} ${VIEW_CENTER_Y}) scale(${viewport.zoom}) translate(${-VIEW_CENTER_X} ${-VIEW_CENTER_Y})`}
            >
                {/* Edges */}
                {edges.map((edge, i) => {
                    const a = nodeMap.get(edge.from_id);
                    const b = nodeMap.get(edge.to_id);
                    if (!a || !b) return null;
                    if (
                        !visibleEdgeKeys.has(
                            `${edge.from_id}|${edge.label}|${edge.to_id}`
                        )
                    ) {
                        return null;
                    }

                    const selected =
                        selectedNodeId === null
                            ? null
                            : selectedNodeId === a.id ||
                              selectedNodeId === b.id;

                    const key = edgeKey(
                        i,
                        edge.from_id,
                        edge.to_id,
                        edge.label
                    );
                    const mx = (a.x + b.x) / 2;
                    const my = (a.y + b.y) / 2;
                    // Angle from source to target - used to point the
                    // direction arrow drawn at the edge's midpoint, rather
                    // than at an endpoint (which the destination node's
                    // circle would just draw over).
                    const angleDeg =
                        Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
                    const dimmed = selected === false && "opacity-50";
                    return (
                        <g key={key}>
                            <path
                                className={cn(
                                    selected === true
                                        ? "stroke-primary"
                                        : "stroke-muted-foreground",
                                    dimmed
                                )}
                                d={curvedEdgePath(a.x, a.y, b.x, b.y, key)}
                                strokeWidth={0.8}
                                fill="none"
                            />
                            <path
                                className={cn(
                                    selected === true
                                        ? "fill-primary"
                                        : "fill-muted-foreground",
                                    dimmed
                                )}
                                transform={`translate(${mx} ${my}) rotate(${angleDeg})`}
                                d="M -4 -3 L 4 0 L -4 3 Z"
                            />
                            <text
                                className={cn(
                                    "font-mono text-[8px]",
                                    selected === true
                                        ? "fill-primary"
                                        : "fill-muted-foreground",
                                    dimmed
                                )}
                                x={mx}
                                y={my - 8}
                                textAnchor="middle"
                            >
                                {edge.label}
                            </text>
                        </g>
                    );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                    if (!visibleNodeIds.has(node.id)) {
                        return null;
                    }

                    const selected =
                        selectedNodeId === null
                            ? null
                            : selectedNodeId === node.id;
                    const { fill, stroke } = colorForType(node.type);

                    return (
                        <g
                            key={node.id}
                            className="cursor-pointer"
                            onClick={() => onSelectNode(node.id)}
                            onPointerDown={viewport.onNodePointerDown(node.id)}
                        >
                            <circle
                                className={cn(
                                    fill,
                                    selected === true
                                        ? "stroke-primary stroke-2"
                                        : cn(stroke, "stroke-1"),
                                    selected === false && "opacity-50"
                                )}
                                cx={node.x}
                                cy={node.y}
                                r={7.5}
                            />
                            <text
                                x={node.x}
                                y={node.y + 20}
                                textAnchor="middle"
                                fontSize="10"
                                className={cn(
                                    "font-mono",
                                    selected === true
                                        ? "fill-primary"
                                        : "fill-muted-foreground",
                                    selected === false && "opacity-50"
                                )}
                            >
                                {node.label}
                            </text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}

export { GraphCanvas };
