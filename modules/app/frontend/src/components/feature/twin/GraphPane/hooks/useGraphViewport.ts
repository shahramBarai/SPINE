import {
    type Dispatch,
    type RefObject,
    type SetStateAction,
    useRef,
    useState
} from "react";
import {
    VIEW_CENTER_X,
    VIEW_CENTER_Y,
    VIEW_HEIGHT,
    VIEW_WIDTH,
    type NodeState
} from "../types/graph";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.5;

// Owns pan/zoom of the SVG viewport plus pointer-driven interaction:
// dragging the background pans, dragging a node moves it (and pins it, via
// `draggedNodeIdRef`, so the physics simulation in useGraphNodes leaves it
// alone).
function useGraphViewport({
    nodes,
    setNodes,
    draggedNodeIdRef,
    onBackgroundClick
}: {
    nodes: NodeState[];
    setNodes: Dispatch<SetStateAction<NodeState[]>>;
    draggedNodeIdRef: RefObject<string | null>;
    onBackgroundClick: () => void;
}) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    const didDragNodeRef = useRef(false);
    const modeRef = useRef<"pan" | "drag" | null>(null);
    const activePointerRef = useRef<number | null>(null);
    const lastPointerRef = useRef<{ x: number; y: number } | null>(null);

    const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.1 : 0.9;
        setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor)));
    };

    const onPointerDownBackground = (
        event: React.PointerEvent<SVGSVGElement>
    ) => {
        if ((event.target as SVGElement).tagName !== "svg") {
            return;
        }
        if (event.button === 0) {
            onBackgroundClick();
        }
        modeRef.current = "pan";
        activePointerRef.current = event.pointerId;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onNodePointerDown =
        (nodeId: string) => (event: React.PointerEvent<SVGGElement>) => {
            event.stopPropagation();
            modeRef.current = "drag";
            activePointerRef.current = event.pointerId;
            draggedNodeIdRef.current = nodeId;
            didDragNodeRef.current = false;
            lastPointerRef.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
        };

    const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
        if (activePointerRef.current !== event.pointerId) {
            return;
        }

        const last = lastPointerRef.current;
        if (!last) {
            return;
        }
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };

        if (draggedNodeIdRef.current) {
            const id = draggedNodeIdRef.current;
            didDragNodeRef.current = true;
            setNodes((prev) =>
                prev.map((n) =>
                    n.id === id
                        ? {
                              ...n,
                              x: n.x + dx / zoom,
                              y: n.y + dy / zoom,
                              vx: 0,
                              vy: 0,
                              fixed: true
                          }
                        : n
                )
            );
            return;
        }

        if (modeRef.current === "pan") {
            setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
    };

    const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
        if (activePointerRef.current !== event.pointerId) {
            return;
        }

        if (draggedNodeIdRef.current && didDragNodeRef.current) {
            const draggedNodeId = draggedNodeIdRef.current;
            setNodes((prev) =>
                prev.map((node) =>
                    node.id === draggedNodeId
                        ? { ...node, fixed: true, vx: 0, vy: 0 }
                        : node
                )
            );
        }

        draggedNodeIdRef.current = null;
        didDragNodeRef.current = false;
        modeRef.current = null;
        activePointerRef.current = null;
        lastPointerRef.current = null;
    };

    // Fits the given nodes (or all nodes, if omitted) to the viewport.
    const fitToScreen = (subset?: NodeState[]) => {
        const source = subset && subset.length ? subset : nodes;
        if (!source.length) {
            return;
        }

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const n of source) {
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x);
            minY = Math.min(minY, n.y);
            maxY = Math.max(maxY, n.y);
        }

        const width = Math.max(maxX - minX, 50);
        const height = Math.max(maxY - minY, 50);
        const margin = 60;
        const fitZoom = Math.max(
            MIN_ZOOM,
            Math.min(
                MAX_ZOOM,
                Math.min(
                    (VIEW_WIDTH - margin) / width,
                    (VIEW_HEIGHT - margin) / height
                )
            )
        );
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        setZoom(fitZoom * 0.8); // Slightly zoomed out to give a margin
        setPan({
            x: fitZoom * (VIEW_CENTER_X - cx),
            y: fitZoom * (VIEW_CENTER_Y - cy)
        });
    };

    const focusOnNode = (nodeId: string) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) {
            return;
        }
        setPan({
            x: zoom * (VIEW_CENTER_X - node.x),
            y: zoom * (VIEW_CENTER_Y - node.y)
        });
    };

    const resetView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    return {
        zoom,
        pan,
        onWheel,
        onPointerDownBackground,
        onPointerMove,
        onPointerUp,
        onNodePointerDown,
        fitToScreen,
        focusOnNode,
        resetView
    };
}

export { useGraphViewport };
