export type GraphNode = {
    id: string;
    label: string;
    type: string;
    sameAsIds: string[];
};
export type GraphEdge = { from_id: string; to_id: string; label: string };
export type GraphData = { nodes: GraphNode[]; edges: GraphEdge[] };

export type NodeState = {
    id: string;
    label: string;
    type: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fixed: boolean;
};

export type LayoutPosition = { x: number; y: number };

// The graph is laid out on a fixed virtual canvas and then panned/zoomed via
// an SVG transform, so these dimensions are geometry constants, not pixels.
export const VIEW_WIDTH = 700;
export const VIEW_HEIGHT = 420;
export const VIEW_CENTER_X = VIEW_WIDTH / 2;
export const VIEW_CENTER_Y = VIEW_HEIGHT / 2;

// useGraphNodes' repulsion pass is O(n^2) per animation frame - past this
// many nodes it starts visibly janking the tab, so physics auto-disables
// (falling back to the static hub-cluster layout) above this count.
export const PHYSICS_NODE_LIMIT = 200;

// Bulk leaf-level rdf:types (e.g. every individual IFC wall/plate/member is
// a bot:Element) that can number in the thousands and rarely carry useful
// relationship info for an overview - excluded from the relationship graph
// query by default, with an explicit opt-in to fetch them (see
// GraphFilterPanel).
export const DEFAULT_EXCLUDED_NODE_TYPES = ["Element"];
