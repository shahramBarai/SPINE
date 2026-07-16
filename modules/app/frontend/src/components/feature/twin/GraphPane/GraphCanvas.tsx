import { useMemo, useState } from "react";

import { useGraphNodes } from "./hooks/useGraphNodes";
import {
    PHYSICS_NODE_LIMIT,
    VIEW_CENTER_X,
    VIEW_CENTER_Y,
    VIEW_HEIGHT,
    VIEW_WIDTH,
    type GraphData
} from "./types/graph";
import { curvedEdgePath, edgeKey } from "./utils/graphLayout";
import { colorForNodeType } from "./utils/nodeTypeColors";
import { useGraphViewport } from "./hooks/useGraphViewport";
import { GraphToolbar } from "./GraphToolbar";
import { GraphFilterPanel } from "./GraphFilterPanel";
import { cn } from "utils/index";
import { useDigitalTwin } from "hooks/useDigitalTwin";

function GraphCanvas({
    graphData,
    centerNodeId,
    showBulkNodeTypes,
    onToggleBulkNodeTypes
}: {
    graphData: GraphData;
    centerNodeId: string | null;
    showBulkNodeTypes: boolean;
    onToggleBulkNodeTypes: () => void;
}) {
    const [physicsEnabled, setPhysicsEnabled] = useState(true);
    const physicsAvailable = graphData.nodes.length <= PHYSICS_NODE_LIMIT;
    const effectivePhysicsEnabled = physicsEnabled && physicsAvailable;

    const {
        selectedObjectIds,
        selectObject,
        clearSelection,
        selectedNodeTypes,
        setSelectedNodeTypes,
        selectedPredicates,
        setSelectedPredicates
    } = useDigitalTwin();

    const { nodes, setNodes, draggedNodeIdRef, restoreDefaultLayout } =
        useGraphNodes({
            graphData,
            physicsEnabled: effectivePhysicsEnabled
        });
    const viewport = useGraphViewport({
        nodes,
        setNodes,
        draggedNodeIdRef,
        onBackgroundClick: clearSelection
    });

    const nodeTypeUniverse = useMemo(
        () => Array.from(new Set(graphData.nodes.map((n) => n.type))).sort(),
        [graphData.nodes]
    );
    const predicateUniverse = useMemo(
        () => Array.from(new Set(graphData.edges.map((e) => e.label))).sort(),
        [graphData.edges]
    );

    const [filterPanelOpen, setFilterPanelOpen] = useState(false);

    // null (or a Set covering the whole universe) means "unrestricted" -
    // toggling one off materializes a concrete Set of everything else, and
    // re-checking everything collapses back to null rather than carrying
    // around a full-universe Set.
    const toggleNodeType = (type: string) => {
        setSelectedNodeTypes((prev) => {
            const next = new Set(prev ?? nodeTypeUniverse);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next.size === nodeTypeUniverse.length ? null : next;
        });
    };
    const togglePredicate = (predicate: string) => {
        setSelectedPredicates((prev) => {
            const next = new Set(prev ?? predicateUniverse);
            if (next.has(predicate)) {
                next.delete(predicate);
            } else {
                next.add(predicate);
            }
            return next.size === predicateUniverse.length ? null : next;
        });
    };
    const filterActive =
        selectedNodeTypes !== null || selectedPredicates !== null;

    // Turns the always-loaded, unfiltered graphData plus the shared type/
    // predicate selections into the set of nodes/edges that should actually
    // render. Deliberately client-side only (no re-querying Fuseki per
    // checkbox click) - the backend's includeNodeTypes/includePredicates
    // params exist for callers who already know what they want, not for
    // driving this interactive UI.
    const { visibleNodeIds, visibleEdgeKeys } = useMemo(() => {
        // An empty selection means "nothing unchecked yet", not "hide
        // everything" - same convention as the backend's undefined/[].
        const nodeTypeOk = (id: string, type: string) =>
            id === centerNodeId ||
            !selectedNodeTypes ||
            selectedNodeTypes.size === 0 ||
            selectedNodeTypes.has(type);

        const visibleNodeIds = new Set(
            graphData.nodes
                .filter((node) => nodeTypeOk(node.id, node.type))
                .map((node) => node.id)
        );

        const visibleEdgeKeys = new Set(
            graphData.edges
                .filter((edge) => {
                    const predicateOk =
                        !selectedPredicates ||
                        selectedPredicates.size === 0 ||
                        selectedPredicates.has(edge.label);
                    return (
                        predicateOk &&
                        visibleNodeIds.has(edge.from_id) &&
                        visibleNodeIds.has(edge.to_id)
                    );
                })
                .map((edge) => `${edge.from_id}|${edge.label}|${edge.to_id}`)
        );

        return { visibleNodeIds, visibleEdgeKeys };
    }, [graphData, centerNodeId, selectedNodeTypes, selectedPredicates]);

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return (
        <div className="absolute inset-0 grid-bg">
            <GraphToolbar
                className="absolute top-12 left-3 z-20"
                nodes={graphData.nodes}
                onFitToScreen={() => viewport.fitToScreen()}
                onFocusSelection={() =>
                    selectedObjectIds[0]
                        ? viewport.focusOnNode(selectedObjectIds[0])
                        : viewport.fitToScreen()
                }
                physicsEnabled={effectivePhysicsEnabled}
                physicsLocked={!physicsAvailable}
                onTogglePhysics={() => setPhysicsEnabled((prev) => !prev)}
                onRestoreLayout={restoreDefaultLayout}
                onResetView={() => viewport.resetView()}
                onToggleFilterPanel={() => setFilterPanelOpen((prev) => !prev)}
                filterActive={filterActive}
            />

            {filterPanelOpen && (
                <GraphFilterPanel
                    className="absolute top-12 right-3 z-20"
                    nodeTypes={nodeTypeUniverse}
                    predicates={predicateUniverse}
                    selectedNodeTypes={selectedNodeTypes}
                    selectedPredicates={selectedPredicates}
                    onToggleNodeType={toggleNodeType}
                    onTogglePredicate={togglePredicate}
                    showBulkNodeTypes={showBulkNodeTypes}
                    onToggleBulkNodeTypes={onToggleBulkNodeTypes}
                    onClose={() => setFilterPanelOpen(false)}
                />
            )}

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
                    {graphData.edges.map((edge, i) => {
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
                            selectedObjectIds.length === 0
                                ? null
                                : selectedObjectIds.includes(a.id) ||
                                  selectedObjectIds.includes(b.id);

                        const key = edgeKey(
                            i,
                            edge.from_id,
                            edge.to_id,
                            edge.label
                        );
                        const mx = (a.x + b.x) / 2;
                        const my = (a.y + b.y) / 2;
                        // Angle from source to target - used to point the
                        // direction arrow drawn at the edge's midpoint,
                        // rather than at an endpoint (which the destination
                        // node's circle would just draw over).
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
                            selectedObjectIds.length === 0
                                ? null
                                : selectedObjectIds.includes(node.id);
                        const { fill, stroke } = colorForNodeType(node.type);

                        return (
                            <g
                                key={node.id}
                                className="cursor-pointer"
                                onClick={() =>
                                    selectObject(node.id, node.sameAsIds)
                                }
                                onPointerDown={viewport.onNodePointerDown(
                                    node.id
                                )}
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

            <div
                className={cn(
                    "absolute bottom-3 right-3 z-20 px-2.5 py-1.5",
                    "rounded-md bg-surface text-muted-foreground",
                    "border border-border/60",
                    "text-[10px] font-mono"
                )}
            >
                {filterActive
                    ? `${visibleNodeIds.size} of ${graphData.nodes.length} nodes · ${visibleEdgeKeys.size} of ${graphData.edges.length} edges`
                    : `${graphData.nodes.length} nodes · ${graphData.edges.length} edges`}{" "}
                · zoom {viewport.zoom.toFixed(2)}x
            </div>
        </div>
    );
}

export { GraphCanvas };
