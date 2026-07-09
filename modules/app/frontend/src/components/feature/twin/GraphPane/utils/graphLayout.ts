import {
    VIEW_CENTER_X,
    VIEW_CENTER_Y,
    type LayoutPosition
} from "../types/graph";

export const edgeKey = (
    index: number,
    fromId: string,
    toId: string,
    label: string
): string => `${index}:${fromId}->${toId}:${label}`;

const stableCurveDirection = (key: string): number => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 33 + key.charCodeAt(i)) | 0;
    }
    return hash % 2 === 0 ? 1 : -1;
};

/**
 * Bends every edge slightly (in a stable, key-derived direction) so that
 * parallel/overlapping edges between the same two nodes stay distinguishable.
 * @param x1 From node's x position
 * @param y1 From node's y position
 * @param x2 To node's x position
 * @param y2 To node's y position
 * @param key A stable key for this edge (e.g. the edge's index in the graph data array)
 * @returns
 */
export const curvedEdgePath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    key: string
): string => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
    const nx = -dy / distance;
    const ny = dx / distance;
    const bend =
        Math.min(36, Math.max(10, distance * 0.15)) * stableCurveDirection(key);
    const cx = (x1 + x2) / 2 + nx * bend;
    const cy = (y1 + y2) / 2 + ny * bend;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
};

/**
 * Creates a hub-based cluster layout for the graph.
 *
 * Places the highest-degree nodes ("hubs") on a ring around the center, then
 * arranges each hub's connected nodes on rings around it - gives a readable
 * initial layout before the physics simulation takes over.
 *
 * @param rawNodes The list of nodes in the graph.
 * @param edges The list of edges in the graph.
 * @returns A map of node IDs to their layout positions.
 */
export function createHubClusterLayout(
    rawNodes: { id: string }[],
    edges: { from_id: string; to_id: string }[]
): Map<string, LayoutPosition> {
    const layout = new Map<string, LayoutPosition>();
    if (!rawNodes.length) {
        return layout;
    }

    const adjacency = new Map<string, Set<string>>();
    for (const node of rawNodes) {
        adjacency.set(node.id, new Set());
    }
    for (const edge of edges) {
        adjacency.get(edge.from_id)?.add(edge.to_id);
        adjacency.get(edge.to_id)?.add(edge.from_id);
    }

    const degree = new Map<string, number>();
    for (const node of rawNodes) {
        degree.set(node.id, adjacency.get(node.id)?.size ?? 0);
    }

    const sortedByDegree = [...rawNodes]
        .map((node) => ({ id: node.id, degree: degree.get(node.id) ?? 0 }))
        .sort((a, b) => b.degree - a.degree || a.id.localeCompare(b.id));

    const connectedNodeCount = sortedByDegree.filter(
        (entry) => entry.degree > 0
    ).length;
    const maxHubs = Math.min(3, Math.max(1, Math.ceil(rawNodes.length / 28)));
    const hubCount = Math.min(maxHubs, Math.max(1, connectedNodeCount || 1));
    const hubIds = sortedByDegree.slice(0, hubCount).map((entry) => entry.id);
    const primaryHubId = hubIds[0];
    if (primaryHubId === undefined) {
        // hubCount is always >= 1 (see Math.max(1, ...) above), so hubIds is
        // never empty - this is unreachable, but bail out rather than crash.
        return layout;
    }
    const hubSet = new Set(hubIds);

    if (hubCount === 1) {
        layout.set(primaryHubId, { x: VIEW_CENTER_X, y: VIEW_CENTER_Y });
    } else {
        const hubRingRadius = 85;
        hubIds.forEach((hubId, index) => {
            const angle = (Math.PI * 2 * index) / hubCount - Math.PI / 2;
            layout.set(hubId, {
                x: VIEW_CENTER_X + Math.cos(angle) * hubRingRadius,
                y: VIEW_CENTER_Y + Math.sin(angle) * hubRingRadius
            });
        });
    }

    const owner = new Map<string, string>();
    const queue: string[] = [];
    for (const hubId of hubIds) {
        owner.set(hubId, hubId);
        queue.push(hubId);
    }

    let queueIndex = 0;
    while (queueIndex < queue.length) {
        // In bounds by the loop condition above.
        const currentId = queue[queueIndex++]!;
        const currentOwner = owner.get(currentId);
        if (!currentOwner) {
            continue;
        }

        const neighbors = adjacency.get(currentId);
        if (!neighbors) {
            continue;
        }

        for (const neighbor of neighbors) {
            if (owner.has(neighbor)) {
                continue;
            }
            owner.set(neighbor, currentOwner);
            queue.push(neighbor);
        }
    }

    for (const node of rawNodes) {
        if (!owner.has(node.id)) {
            owner.set(node.id, primaryHubId);
        }
    }

    const nodesByHub = new Map<string, string[]>();
    for (const hubId of hubIds) {
        nodesByHub.set(hubId, []);
    }

    for (const node of rawNodes) {
        if (hubSet.has(node.id)) {
            continue;
        }
        const hubId = owner.get(node.id) ?? primaryHubId;
        const group = nodesByHub.get(hubId);
        if (group) {
            group.push(node.id);
        }
    }

    hubIds.forEach((hubId, hubIndex) => {
        const hubPosition = layout.get(hubId) ?? {
            x: VIEW_CENTER_X,
            y: VIEW_CENTER_Y
        };
        const group = nodesByHub.get(hubId) ?? [];
        group.sort(
            (a, b) =>
                (degree.get(b) ?? 0) - (degree.get(a) ?? 0) ||
                a.localeCompare(b)
        );

        let placed = 0;
        let ring = 0;
        const startAngle = ((Math.PI * 2) / Math.max(1, hubCount)) * hubIndex;

        while (placed < group.length) {
            const ringRadius = 62 + ring * 42;
            const ringCapacity = Math.max(8, 8 + ring * 6);
            const ringItems = group.slice(placed, placed + ringCapacity);

            ringItems.forEach((nodeId, localIndex) => {
                const angle =
                    startAngle + (Math.PI * 2 * localIndex) / ringItems.length;
                layout.set(nodeId, {
                    x: hubPosition.x + Math.cos(angle) * ringRadius,
                    y: hubPosition.y + Math.sin(angle) * ringRadius
                });
            });

            placed += ringItems.length;
            ring += 1;
        }
    });

    let spilloverCursor = 0;
    for (const node of rawNodes) {
        if (layout.has(node.id)) {
            continue;
        }

        const fallbackRadius = 160 + Math.floor(spilloverCursor / 12) * 36;
        const fallbackAngle = (Math.PI * 2 * (spilloverCursor % 12)) / 12;
        layout.set(node.id, {
            x: VIEW_CENTER_X + Math.cos(fallbackAngle) * fallbackRadius,
            y: VIEW_CENTER_Y + Math.sin(fallbackAngle) * fallbackRadius
        });
        spilloverCursor += 1;
    }

    return layout;
}
