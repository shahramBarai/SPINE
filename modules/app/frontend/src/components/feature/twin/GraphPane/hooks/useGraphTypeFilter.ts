import { useMemo } from "react";
import { type GraphData } from "../types/graph";

// Turns the always-loaded, unfiltered graphData plus the user's checkbox
// selections into the set of nodes/edges that should actually render.
// Deliberately client-side only (no re-querying Fuseki per checkbox click,
// same reasoning as useGraphSearch) - the backend's includeNodeTypes/
// includePredicates params exist for callers who already know what they
// want, not for driving this interactive UI.
function useGraphTypeFilter({
    graphData,
    centerNodeId,
    selectedNodeTypes,
    selectedPredicates
}: {
    graphData: GraphData;
    centerNodeId: string | null;
    selectedNodeTypes: Set<string> | null;
    selectedPredicates: Set<string> | null;
}): { visibleNodeIds: Set<string>; visibleEdgeKeys: Set<string> } {
    return useMemo(() => {
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
}

export { useGraphTypeFilter };
