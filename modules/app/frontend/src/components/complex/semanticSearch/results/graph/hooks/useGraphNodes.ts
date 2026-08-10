import { useEffect, useRef, useState } from "react";
import {
    VIEW_CENTER_X,
    VIEW_CENTER_Y,
    type GraphData,
    type LayoutPosition,
    type NodeState
} from "../types";
import { createHubClusterLayout } from "../utils/graphLayout";

const SOFT_LAYOUT_RADIUS = 250;
const SOFT_LAYOUT_SPRING = 0.003;
const CENTER_GRAVITY = 0.0007;

// Owns the live (physics-simulated, drag-editable) node positions, seeded
// from a hub-cluster default layout whenever the underlying graph changes.
function useGraphNodes({
    graphData,
    physicsEnabled
}: {
    graphData: GraphData;
    physicsEnabled: boolean;
}) {
    const [nodes, setNodes] = useState<NodeState[]>([]);
    const defaultLayoutRef = useRef<Map<string, LayoutPosition>>(new Map());
    const draggedNodeIdRef = useRef<string | null>(null);

    useEffect(() => {
        const defaultLayout = createHubClusterLayout(
            graphData.nodes,
            graphData.edges
        );
        defaultLayoutRef.current = defaultLayout;

        setNodes((prev) => {
            const previousById = new Map(prev.map((node) => [node.id, node]));

            return graphData.nodes.map((rawNode) => {
                const existing = previousById.get(rawNode.id);
                if (existing) {
                    return {
                        ...existing,
                        label: rawNode.label,
                        type: rawNode.type
                    };
                }

                const position = defaultLayout.get(rawNode.id);
                return {
                    id: rawNode.id,
                    label: rawNode.label,
                    type: rawNode.type,
                    x: position?.x ?? VIEW_CENTER_X,
                    y: position?.y ?? VIEW_CENTER_Y,
                    vx: 0,
                    vy: 0,
                    fixed: false
                };
            });
        });
    }, [graphData.nodes, graphData.edges]);

    useEffect(() => {
        if (!nodes.length) {
            return;
        }

        let animationId = 0;
        const step = () => {
            setNodes((prev) => {
                if (!physicsEnabled || prev.length <= 1) {
                    return prev;
                }

                const next = prev.map((n) => ({ ...n }));
                const byId = new Map(next.map((n) => [n.id, n]));

                // Repulsion between all node pairs.
                for (let i = 0; i < next.length; i++) {
                    for (let j = i + 1; j < next.length; j++) {
                        // Bounds are guaranteed by the loop conditions above.
                        const a = next[i]!;
                        const b = next[j]!;
                        let dx = b.x - a.x;
                        let dy = b.y - a.y;
                        const distSq = Math.max(dx * dx + dy * dy, 64);
                        const dist = Math.sqrt(distSq);
                        dx /= dist;
                        dy /= dist;
                        const force = 1800 / distSq;
                        a.vx -= dx * force;
                        a.vy -= dy * force;
                        b.vx += dx * force;
                        b.vy += dy * force;
                    }
                }

                // Edge spring forces.
                for (const edge of graphData.edges) {
                    const a = byId.get(edge.from_id);
                    const b = byId.get(edge.to_id);
                    if (!a || !b) {
                        continue;
                    }

                    let dx = b.x - a.x;
                    let dy = b.y - a.y;
                    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                    dx /= dist;
                    dy /= dist;
                    const desired = 120;
                    const spring = (dist - desired) * 0.005;
                    a.vx += dx * spring;
                    a.vy += dy * spring;
                    b.vx -= dx * spring;
                    b.vy -= dy * spring;
                }

                // Integrate.
                for (const n of next) {
                    if (draggedNodeIdRef.current === n.id || n.fixed) {
                        n.vx = 0;
                        n.vy = 0;
                        continue;
                    }

                    const centerDx = VIEW_CENTER_X - n.x;
                    const centerDy = VIEW_CENTER_Y - n.y;
                    n.vx += centerDx * CENTER_GRAVITY;
                    n.vy += centerDy * CENTER_GRAVITY;

                    const radiusDx = n.x - VIEW_CENTER_X;
                    const radiusDy = n.y - VIEW_CENTER_Y;
                    const radius = Math.sqrt(
                        radiusDx * radiusDx + radiusDy * radiusDy
                    );
                    if (radius > SOFT_LAYOUT_RADIUS) {
                        const overflow = radius - SOFT_LAYOUT_RADIUS;
                        const ux = radiusDx / radius;
                        const uy = radiusDy / radius;
                        n.vx -= ux * overflow * SOFT_LAYOUT_SPRING;
                        n.vy -= uy * overflow * SOFT_LAYOUT_SPRING;
                    }

                    n.vx *= 0.9;
                    n.vy *= 0.9;
                    n.x += n.vx;
                    n.y += n.vy;
                }

                return next;
            });

            animationId = requestAnimationFrame(step);
        };

        animationId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationId);
    }, [graphData.edges, nodes.length, physicsEnabled]);

    const restoreDefaultLayout = () => {
        const defaultLayout = defaultLayoutRef.current;
        setNodes((prev) =>
            prev.map((node) => {
                const position = defaultLayout.get(node.id);
                if (!position) {
                    return { ...node, fixed: false, vx: 0, vy: 0 };
                }
                return {
                    ...node,
                    x: position.x,
                    y: position.y,
                    vx: 0,
                    vy: 0,
                    fixed: false
                };
            })
        );
    };

    return { nodes, setNodes, draggedNodeIdRef, restoreDefaultLayout };
}

export { useGraphNodes };
