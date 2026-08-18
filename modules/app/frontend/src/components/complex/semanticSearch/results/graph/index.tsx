import { useEffect, useMemo, useRef, useState } from "react";
import { GraphCanvas } from "./GraphCanvas";
import { GraphFilterPanel } from "./GraphFilterPanel";
import { GraphLegend } from "./GraphLegend";
import { GraphToolbar } from "./GraphToolbar";
import { SelectionPanel } from "./SelectionPanel";
import { useGraphNodes } from "./hooks/useGraphNodes";
import { useGraphSearch } from "./hooks/useGraphSearch";
import { useGraphViewport } from "./hooks/useGraphViewport";
import { PHYSICS_NODE_LIMIT, type GraphData } from "./types";
import { cn } from "utils/index";

/**
 * Self-contained, data-source-agnostic node/edge viewer: pan/zoom, a physics
 * layout, type/relation filtering, search and a property panel over whatever
 * graph the caller hands it. It owns all of its interaction state locally,
 * so nothing here knows where the graph came from.
 *
 * @param graphData The nodes and edges to render. Must be referentially stable (memoize it) - it seeds the layout.
 * @param className Extra classes for the viewer's container.
 */
function GraphView({
    graphData,
    className
}: {
    graphData: GraphData;
    className?: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState("");
    const [selectedNodeTypes, setSelectedNodeTypes] =
        useState<Set<string> | null>(null);
    const [selectedPredicates, setSelectedPredicates] =
        useState<Set<string> | null>(null);
    const [filterPanelOpen, setFilterPanelOpen] = useState(false);
    const [physicsEnabled, setPhysicsEnabled] = useState(true);

    const physicsAvailable = graphData.nodes.length <= PHYSICS_NODE_LIMIT;
    const effectivePhysicsEnabled = physicsEnabled && physicsAvailable;

    const { nodes, setNodes, draggedNodeIdRef, restoreDefaultLayout } =
        useGraphNodes({
            graphData,
            physicsEnabled: effectivePhysicsEnabled
        });
    const viewport = useGraphViewport({
        nodes,
        setNodes,
        draggedNodeIdRef,
        onBackgroundClick: () => setSelectedNodeId(null)
    });

    const searchMatchId = useGraphSearch({
        nodes: graphData.nodes,
        searchText
    });
    useEffect(() => setSelectedNodeId(searchMatchId), [searchMatchId]);

    const nodeTypeUniverse = useMemo(
        () => Array.from(new Set(graphData.nodes.map((n) => n.type))).sort(),
        [graphData.nodes]
    );
    const predicateUniverse = useMemo(
        () => Array.from(new Set(graphData.edges.map((e) => e.label))).sort(),
        [graphData.edges]
    );

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

    // Turns the full graph plus the type/predicate selections into the set of
    // nodes and edges that should actually render.
    const { visibleNodeIds, visibleEdgeKeys } = useMemo(() => {
        // An empty selection means "nothing unchecked yet", not "hide
        // everything".
        const nodeTypeOk = (type: string) =>
            !selectedNodeTypes ||
            selectedNodeTypes.size === 0 ||
            selectedNodeTypes.has(type);

        const visibleNodeIds = new Set(
            graphData.nodes
                .filter((node) => nodeTypeOk(node.type))
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
    }, [graphData, selectedNodeTypes, selectedPredicates]);

    const selectedNode =
        graphData.nodes.find((node) => node.id === selectedNodeId) ?? null;

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative h-full w-full overflow-hidden rounded-lg",
                "border border-border/60 bg-card/40 grid-bg",
                className
            )}
        >
            <GraphToolbar
                className="absolute top-3 left-3 z-20"
                searchText={searchText}
                onSearchTextChange={setSearchText}
                onFitToScreen={() => viewport.fitToScreen()}
                onFocusSelection={() =>
                    selectedNodeId
                        ? viewport.focusOnNode(selectedNodeId)
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
                    className="absolute top-3 right-3 z-20"
                    nodeTypes={nodeTypeUniverse}
                    predicates={predicateUniverse}
                    selectedNodeTypes={selectedNodeTypes}
                    selectedPredicates={selectedPredicates}
                    onToggleNodeType={toggleNodeType}
                    onTogglePredicate={togglePredicate}
                    onClose={() => setFilterPanelOpen(false)}
                />
            )}

            <GraphCanvas
                nodes={nodes}
                edges={graphData.edges}
                visibleNodeIds={visibleNodeIds}
                visibleEdgeKeys={visibleEdgeKeys}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                viewport={viewport}
            />

            <GraphLegend nodes={graphData.nodes} />

            <SelectionPanel
                containerRef={containerRef}
                node={selectedNode}
                onClose={() => setSelectedNodeId(null)}
            />

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

export { GraphView };
