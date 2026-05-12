import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, GitBranch, GripHorizontal, Maximize2, Minimize2, Pause, Play, Search, RotateCcw, RefreshCw, X } from "lucide-react";
import { useGraphQuery } from "@/hooks/use-twin-data";
import { type GraphData, type EntityProperty, fetchEntityProperties } from "@/lib/twin-api";
import { type Triple } from "@/lib/twin-data";

type NodeState = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed: boolean;
};

type LayoutPosition = { x: number; y: number };
type LayoutEdge = { from_id: string; to_id: string };
type LayoutNode = { id: string };
type PanelPosition = { x: number; y: number };

const VIEW_WIDTH = 700;
const VIEW_HEIGHT = 420;
const VIEW_CENTER_X = VIEW_WIDTH / 2;
const VIEW_CENTER_Y = VIEW_HEIGHT / 2;
const SOFT_LAYOUT_RADIUS = 250;
const SOFT_LAYOUT_SPRING = 0.003;
const CENTER_GRAVITY = 0.0007;

const splitCamelCase = (value: string): string => value.replace(/([a-z])([A-Z])/g, "$1 $2");

const RDF_TYPE_PREDICATE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const isRdfTypePredicate = (predicate: string): boolean => {
  const lower = predicate.trim().toLowerCase();
  return lower === RDF_TYPE_PREDICATE || lower === "rdf:type" || lower.endsWith("#type") || lower.endsWith("/type");
};

const typeDisplay = (value: string): string => (value?.trim() ? value : "Unknown");

const toCurieIfKnown = (value: string): string => {
  if (!value) return "Unknown";
  if (!value.includes("#")) return value;

  const [prefix, suffix] = value.split("#");
  const ns = `${prefix}#`;
  if (ns === "https://w3id.org/bot#" || ns === "http://w3id.org/bot#") return `bot:${suffix}`;
  if (ns === "https://brickschema.org/schema/Brick#" || ns === "https://brickschema.org/schema/brick#") return `brick:${suffix}`;
  if (ns === "http://www.w3.org/2000/01/rdf-schema#") return `rdfs:${suffix}`;
  if (ns === "http://www.w3.org/2002/07/owl#") return `owl:${suffix}`;
  if (ns === "http://www.w3.org/1999/02/22-rdf-syntax-ns#") return `rdf:${suffix}`;
  if (ns === "https://w3id.org/fso#" || ns === "http://w3id.org/fso#") return `fso:${suffix}`;
  if (ns === "http://data.ashrae.org/standard223#") return `s223:${suffix}`;
  return value;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const colorForType = (type: string): { fill: string; stroke: string } => {
  const normalized = typeDisplay(type);
  if (normalized === "Unknown") {
    return {
      fill: "hsl(var(--muted) / 0.2)",
      stroke: "hsl(var(--muted-foreground) / 0.8)",
    };
  }

  const hue = hashString(normalized) % 360;
  return {
    fill: `hsl(${hue} 78% 62% / 0.18)`,
    stroke: `hsl(${hue} 76% 56%)`,
  };
};

const searchTokens = (query: string): string[] =>
  query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .flatMap((token) => {
      if (!token) return [];
      const withoutPrefix = token.includes(":") ? token.split(":").pop() ?? "" : "";
      return withoutPrefix ? [token, withoutPrefix] : [token];
    });

const edgeKey = (index: number, fromId: string, toId: string, label: string): string => `${index}:${fromId}->${toId}:${label}`;

const stableCurveDirection = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33 + key.charCodeAt(i)) | 0;
  }
  return hash % 2 === 0 ? 1 : -1;
};

const curvedEdgePath = (x1: number, y1: number, x2: number, y2: number, key: string): string => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const nx = -dy / distance;
  const ny = dx / distance;
  const bend = Math.min(36, Math.max(10, distance * 0.15)) * stableCurveDirection(key);
  const cx = (x1 + x2) / 2 + nx * bend;
  const cy = (y1 + y2) / 2 + ny * bend;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
};

const createHubClusterLayout = (rawNodes: LayoutNode[], edges: LayoutEdge[]): Map<string, LayoutPosition> => {
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

  const connectedNodeCount = sortedByDegree.filter((entry) => entry.degree > 0).length;
  const maxHubs = Math.min(3, Math.max(1, Math.ceil(rawNodes.length / 28)));
  const hubCount = Math.min(maxHubs, Math.max(1, connectedNodeCount || 1));
  const hubIds = sortedByDegree.slice(0, hubCount).map((entry) => entry.id);
  const hubSet = new Set(hubIds);

  if (hubCount === 1) {
    layout.set(hubIds[0], { x: VIEW_CENTER_X, y: VIEW_CENTER_Y });
  } else {
    const hubRingRadius = 85;
    hubIds.forEach((hubId, index) => {
      const angle = (Math.PI * 2 * index) / hubCount - Math.PI / 2;
      layout.set(hubId, {
        x: VIEW_CENTER_X + Math.cos(angle) * hubRingRadius,
        y: VIEW_CENTER_Y + Math.sin(angle) * hubRingRadius,
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
    const currentId = queue[queueIndex++];
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
      owner.set(node.id, hubIds[0]);
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
    const hubId = owner.get(node.id) ?? hubIds[0];
    const group = nodesByHub.get(hubId);
    if (group) {
      group.push(node.id);
    }
  }

  hubIds.forEach((hubId, hubIndex) => {
    const hubPosition = layout.get(hubId) ?? { x: VIEW_CENTER_X, y: VIEW_CENTER_Y };
    const group = nodesByHub.get(hubId) ?? [];
    group.sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b));

    let placed = 0;
    let ring = 0;
    const startAngle = ((Math.PI * 2) / Math.max(1, hubCount)) * hubIndex;

    while (placed < group.length) {
      const ringRadius = 62 + ring * 42;
      const ringCapacity = Math.max(8, 8 + ring * 6);
      const ringItems = group.slice(placed, placed + ringCapacity);

      ringItems.forEach((nodeId, localIndex) => {
        const angle = startAngle + (Math.PI * 2 * localIndex) / ringItems.length;
        layout.set(nodeId, {
          x: hubPosition.x + Math.cos(angle) * ringRadius,
          y: hubPosition.y + Math.sin(angle) * ringRadius,
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
      y: VIEW_CENTER_Y + Math.sin(fallbackAngle) * fallbackRadius,
    });
    spilloverCursor += 1;
  }

  return layout;
};

export const GraphPane = ({
  selectedId,
  onSelect,
  graphDataOverride,
  semanticTriples,
  maximized = false,
  onToggleMaximize,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  graphDataOverride?: GraphData | null;
  semanticTriples?: Triple[];
  maximized?: boolean;
  onToggleMaximize?: () => void;
}) => {
  const { data: defaultGraphData } = useGraphQuery(selectedId);
  const graphData = graphDataOverride ?? defaultGraphData;

  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [properties, setProperties] = useState<EntityProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [selectionPanelPosition, setSelectionPanelPosition] = useState<PanelPosition>({ x: 12, y: 208 });
  const [panelVisible, setPanelVisible] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggedNodeIdRef = useRef<string | null>(null);
  const didDragNodeRef = useRef(false);
  const modeRef = useRef<"pan" | "drag" | "orbit" | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const defaultLayoutRef = useRef<Map<string, LayoutPosition>>(new Map());
  const panelDragOffsetRef = useRef<PanelPosition | null>(null);
  const draggingPanelRef = useRef(false);
  const rdfTypeByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    if (!semanticTriples?.length) {
      return map;
    }

    const toIds = (value: string): string[] => {
      if (!value) return [];
      const ids = new Set<string>([value]);

      if (value.includes("#")) {
        const frag = value.split("#").pop();
        if (frag) ids.add(frag);
      }

      if (value.includes("/")) {
        const tail = value.split("/").pop();
        if (tail) ids.add(tail);
      }

      const colonIndex = value.lastIndexOf(":");
      if (colonIndex > 0 && colonIndex < value.length - 1) {
        ids.add(value.slice(colonIndex + 1));
      }

      return Array.from(ids);
    };

    const toTypeLabel = (value: string): string => {
      if (!value) return "Unknown";
      return toCurieIfKnown(value);
    };

    for (const triple of semanticTriples) {
      if (!isRdfTypePredicate(triple.predicate)) {
        continue;
      }
      const typeLabel = toTypeLabel(triple.object);
      for (const id of toIds(triple.subject)) {
        if (!id || map.has(id)) {
          continue;
        }
        map.set(id, typeLabel);
      }
    }

    return map;
  }, [semanticTriples]);

  useEffect(() => {
    const defaultLayout = createHubClusterLayout(graphData.nodes, graphData.edges);
    defaultLayoutRef.current = defaultLayout;

    setNodes((prev) => {
      const previousById = new Map(prev.map((node) => [node.id, node]));

      return graphData.nodes.map((rawNode) => {
        const existing = previousById.get(rawNode.id);
        if (existing) {
          return {
            ...existing,
            label: rawNode.label,
            type: rdfTypeByNodeId.get(rawNode.id) ?? typeDisplay(rawNode.type),
          };
        }

        const defaultPosition = defaultLayout.get(rawNode.id);
        return {
          id: rawNode.id,
          label: rawNode.label,
          type: rdfTypeByNodeId.get(rawNode.id) ?? typeDisplay(rawNode.type),
          x: defaultPosition?.x ?? VIEW_CENTER_X,
          y: defaultPosition?.y ?? VIEW_CENTER_Y,
          vx: 0,
          vy: 0,
          fixed: false,
        };
      });
    });

    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotationDeg(0);
    setSelectedEdgeKey(null);
  }, [graphData.nodes, graphData.edges, rdfTypeByNodeId]);

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
            const a = next[i];
            const b = next[j];
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
          const radius = Math.sqrt(radiusDx * radiusDx + radiusDy * radiusDy);
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

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const selectedEdge = useMemo(() => {
    if (!selectedEdgeKey) {
      return null;
    }
    return graphData.edges.find((edge, index) => edgeKey(index, edge.from_id, edge.to_id, edge.label) === selectedEdgeKey) ?? null;
  }, [graphData.edges, selectedEdgeKey]);

  const isNodeRelatedToSelectedNode = (id: string): boolean => {
    if (!selectedId) return false;
    if (id === selectedId) return true;
    return graphData.edges.some(
      (edge) =>
        (edge.from_id === selectedId && edge.to_id === id) ||
        (edge.to_id === selectedId && edge.from_id === id)
    );
  };

  const isNodeRelatedToSelectedEdge = (id: string): boolean => {
    if (!selectedEdge) {
      return false;
    }
    return selectedEdge.from_id === id || selectedEdge.to_id === id;
  };

  useEffect(() => {
    if (!selectedId || !semanticTriples) {
      setProperties([]);
      setLoadingProperties(false);
      return;
    }

    const uri = semanticTriples.reduce<string | null>((found, triple) => {
      if (found) {
        return found;
      }
      if (triple.subject.endsWith(`#${selectedId}`) || triple.subject.endsWith(`/${selectedId}`)) {
        return triple.subject;
      }
      if (triple.object.endsWith(`#${selectedId}`) || triple.object.endsWith(`/${selectedId}`)) {
        return triple.object;
      }
      return null;
    }, null);

    if (!uri) {
      setProperties([]);
      setLoadingProperties(false);
      return;
    }

    setLoadingProperties(true);
    fetchEntityProperties(uri)
      .then((props) => {
        setProperties(props);
      })
      .catch(() => {
        setProperties([]);
      })
      .finally(() => {
        setLoadingProperties(false);
      });
  }, [selectedId, semanticTriples]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!draggingPanelRef.current) {
        return;
      }

      const container = containerRef.current;
      const offset = panelDragOffsetRef.current;
      if (!container || !offset) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const nextX = Math.max(12, Math.min(rect.width - 220, event.clientX - rect.left - offset.x));
      const nextY = Math.max(56, Math.min(rect.height - 80, event.clientY - rect.top - offset.y));
      setSelectionPanelPosition({ x: nextX, y: nextY });
    };

    const stopDragging = () => {
      draggingPanelRef.current = false;
      panelDragOffsetRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.35, Math.min(3.5, z * factor)));
  };

  const onPointerDownBackground = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).tagName !== "svg") {
      return;
    }
    if (event.button === 0) {
      onSelect(null);
      setSelectedEdgeKey(null);
      setPanelVisible(false);
    }
    modeRef.current = event.button === 2 ? "orbit" : "pan";
    activePointerRef.current = event.pointerId;
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
            ? { ...n, x: n.x + dx / zoom, y: n.y + dy / zoom, vx: 0, vy: 0, fixed: true }
            : n
        )
      );
      return;
    }

    if (modeRef.current === "pan") {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    if (modeRef.current === "orbit") {
      setRotationDeg((value) => value + dx * 0.25);
    }
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (activePointerRef.current !== event.pointerId) {
      return;
    }

    if (draggedNodeIdRef.current && didDragNodeRef.current) {
      const draggedNodeId = draggedNodeIdRef.current;
      setNodes((prev) =>
        prev.map((node) => (node.id === draggedNodeId ? { ...node, fixed: true, vx: 0, vy: 0 } : node))
      );
    }

    draggedNodeIdRef.current = null;
    didDragNodeRef.current = false;
    modeRef.current = null;
    activePointerRef.current = null;
    lastPointerRef.current = null;
  };

  const searchMatches = useMemo(() => {
    const tokens = searchTokens(searchText);
    if (!tokens.length) {
      return null;
    }

    const directNodeIds = new Set<string>();
    const edgeKeys = new Set<string>();

    const matchesAllTokens = (parts: string[]) => {
      const haystack = parts
        .filter(Boolean)
        .map((part) => splitCamelCase(part).toLowerCase())
        .join(" ");
      return tokens.every((token) => haystack.includes(token));
    };

    for (const node of nodes) {
      if (matchesAllTokens([node.id, node.label])) {
        directNodeIds.add(node.id);
      }
    }

    graphData.edges.forEach((edge, index) => {
      const fromLabel = nodeMap.get(edge.from_id)?.label ?? "";
      const toLabel = nodeMap.get(edge.to_id)?.label ?? "";
      if (matchesAllTokens([edge.label, edge.from_id, edge.to_id, fromLabel, toLabel])) {
        edgeKeys.add(edgeKey(index, edge.from_id, edge.to_id, edge.label));
      }
    });

    // Endpoint nodes of matched edges that are not themselves directly matched.
    const edgeEndpointNodeIds = new Set<string>();
    graphData.edges.forEach((edge, index) => {
      if (edgeKeys.has(edgeKey(index, edge.from_id, edge.to_id, edge.label))) {
        if (!directNodeIds.has(edge.from_id)) edgeEndpointNodeIds.add(edge.from_id);
        if (!directNodeIds.has(edge.to_id)) edgeEndpointNodeIds.add(edge.to_id);
      }
    });

    // Neighbor nodes of directly matched nodes (connected but not directly matched).
    const neighborNodeIds = new Set<string>();
    graphData.edges.forEach((edge) => {
      if (directNodeIds.has(edge.from_id) && !directNodeIds.has(edge.to_id)) neighborNodeIds.add(edge.to_id);
      if (directNodeIds.has(edge.to_id) && !directNodeIds.has(edge.from_id)) neighborNodeIds.add(edge.from_id);
    });

    return { directNodeIds, edgeKeys, edgeEndpointNodeIds, neighborNodeIds };
  }, [graphData.edges, nodeMap, nodes, searchText]);

  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      const predicate = prop.property.toLowerCase();
      if (isRdfTypePredicate(predicate)) {
        return false;
      }
      if (predicate.startsWith("https://w3id.org/bot#")) {
        return false;
      }
      if (predicate.startsWith("http://w3id.org/bot#")) {
        return false;
      }
      if (predicate.startsWith("https://brickschema.org/schema/brick#")) {
        return false;
      }
      if (predicate.startsWith("http://data.ashrae.org/standard223#")) {
        return false;
      }
      if (predicate.startsWith("https://w3id.org/fso#")) {
        return false;
      }
      if (predicate.startsWith("http://w3id.org/fso#")) {
        return false;
      }
      return true;
    });
  }, [properties]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      onSelect(null);
      setSelectedEdgeKey(null);
      setPanelVisible(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onSelect]);

  const fitToScreen = () => {
    if (!nodes.length) {
      return;
    }

    const source = searchMatches ? nodes.filter((n) => searchMatches.directNodeIds.has(n.id)) : nodes;
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
    const fitZoom = Math.max(0.35, Math.min(3.5, Math.min((700 - margin) / width, (420 - margin) / height)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    setZoom(fitZoom);
    setPan({ x: 350 - cx * fitZoom, y: 210 - cy * fitZoom });
  };

  const focusSelection = () => {
    if (!selectedId) {
      fitToScreen();
      return;
    }
    const node = nodes.find((n) => n.id === selectedId);
    if (!node) {
      return;
    }
    setPan({ x: 350 - node.x * zoom, y: 210 - node.y * zoom });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotationDeg(0);
    setSearchText("");
  };

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
          fixed: false,
        };
      })
    );
    setSelectedEdgeKey(null);
  };

  const edgeSelectionRows = useMemo(() => {
    if (!selectedEdge) {
      return [];
    }

    return [
      { label: "From", value: nodeMap.get(selectedEdge.from_id)?.label ?? selectedEdge.from_id },
      { label: "Predicate", value: selectedEdge.label },
      { label: "To", value: nodeMap.get(selectedEdge.to_id)?.label ?? selectedEdge.to_id },
    ];
  }, [nodeMap, selectedEdge]);

  const nodeSelectionRows = useMemo(() => {
    if (!selectedId) {
      return [];
    }

    const node = nodeMap.get(selectedId);
    if (!node) {
      return [{ label: "Id", value: selectedId }];
    }

    return [
      { label: "Name", value: node.label },
      { label: "Id", value: node.id },
      { label: "Type", value: node.type },
    ];
  }, [nodeMap, selectedId]);

  const showSelectionPanel = Boolean(selectedId && panelVisible);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-card/40">
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 glass rounded-md px-2.5 py-1.5">
        <GitBranch className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Dynamic Knowledge Graph
        </span>
      </div>

      <div className="absolute top-12 left-3 z-20 flex items-center gap-1.5 glass rounded-md p-1.5">
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search nodes and predicates"
            className="h-7 w-40 pl-7 pr-2 rounded bg-background/70 border border-border/60 text-[11px] font-mono outline-none focus:border-primary/50"
          />
        </div>
        <button
          onClick={fitToScreen}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="Fit graph"
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={focusSelection}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="Focus selection"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setPhysicsEnabled((value) => !value)}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
          title={physicsEnabled ? "Pause physics" : "Resume physics"}
        >
          {physicsEnabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={restoreDefaultLayout}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="Restore node layout"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={resetView}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
          title="Reset view"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 glass rounded-md p-1">
        <button
          onClick={onToggleMaximize}
          className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {showSelectionPanel && (
        <div
          className="absolute z-20 w-72 max-h-56 overflow-hidden rounded-md border border-border/60 bg-background/90 shadow-elevated backdrop-blur-md"
          style={{ left: `${selectionPanelPosition.x}px`, top: `${selectionPanelPosition.y}px` }}
        >
          <div
            className="flex cursor-grab items-center justify-between border-b border-border/60 px-3 py-2 active:cursor-grabbing"
            onPointerDown={(event) => {
              event.stopPropagation();
              const panelRect = event.currentTarget.parentElement?.getBoundingClientRect();
              if (!panelRect) {
                return;
              }
              draggingPanelRef.current = true;
              panelDragOffsetRef.current = {
                x: event.clientX - panelRect.left,
                y: event.clientY - panelRect.top,
              };
            }}
          >
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                {selectedEdge ? "Edge Details" : "Properties"}
              </div>
              <div className="text-[10px] text-muted-foreground/80">
                {selectedEdge ? "Drag this panel away from the selected link." : "Drag this panel away from the selected item."}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                type="button"
                className="rounded p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                aria-label="Close properties"
                onClick={(event) => {
                  event.stopPropagation();
                  draggingPanelRef.current = false;
                  panelDragOffsetRef.current = null;
                  setSelectedEdgeKey(null);
                  setPanelVisible(false);
                  onSelect(null);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-40 overflow-auto px-3 py-2">
            {selectedEdge ? (
              <div className="space-y-2 text-[11px]">
                {edgeSelectionRows.map((row) => (
                  <div key={row.label} className="border-b border-border/30 pb-1 last:border-b-0">
                    <div className="text-[10px] font-mono text-primary">{row.label}</div>
                    <div className="break-words font-mono text-[10px] text-muted-foreground">{row.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 text-[11px]">
                {nodeSelectionRows.map((row) => (
                  <div key={row.label} className="border-b border-border/30 pb-1 last:border-b-0">
                    <div className="text-[10px] font-mono text-primary">{row.label}</div>
                    <div className="break-words font-mono text-[10px] text-muted-foreground">{row.value}</div>
                  </div>
                ))}
                {loadingProperties && (
                  <div className="pt-1 text-[10px] font-mono text-muted-foreground">Loading properties...</div>
                )}
                {filteredProperties.map((prop, idx) => {
                  const propName = prop.property.includes("#") ? prop.property.split("#").pop() : prop.property.split("/").pop();
                  const valueDisplay = prop.value.length > 60 ? `${prop.value.substring(0, 57)}...` : prop.value;

                  return (
                    <div key={idx} className="border-b border-border/30 pb-1 last:border-b-0">
                      <div className="text-[10px] font-mono text-primary">{propName}</div>
                      <div className="break-words font-mono text-[10px] text-muted-foreground">{valueDisplay}</div>
                    </div>
                  );
                })}
                {!loadingProperties && filteredProperties.length === 0 && (
                  <div className="pt-1 text-[10px] font-mono text-muted-foreground">No additional RDF properties found for this node.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="absolute inset-0 grid-bg">
        <svg
          viewBox="0 0 700 420"
          className="w-full h-full"
          onWheel={onWheel}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={onPointerDownBackground}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          ref={svgRef}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--muted-foreground) / 0.6)" />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
            </marker>
          </defs>

          <g transform={`translate(${pan.x} ${pan.y}) translate(350 210) rotate(${rotationDeg}) scale(${zoom}) translate(-350 -210)`}>
            {/* Edges */}
            {graphData.edges.map((e, i) => {
              const a = nodeMap.get(e.from_id);
              const b = nodeMap.get(e.to_id);
              if (!a || !b) return null;
              const key = edgeKey(i, e.from_id, e.to_id, e.label);
              const selected = selectedEdgeKey === key;
              const relatedToSelectedNode = !!selectedId && (e.from_id === selectedId || e.to_id === selectedId);
              const edgeMatchesSearch = searchMatches?.edgeKeys.has(key) ?? false;
              const edgeNeighborsMatchedNode =
                (searchMatches?.directNodeIds.has(e.from_id) || searchMatches?.directNodeIds.has(e.to_id)) ?? false;

              let stroke = "hsl(var(--border))";
              let strokeWidth = 0.8;
              let markerEnd = "url(#arrow)";
              let opacity = 1;

              if (searchMatches) {
                // Search is active: mirror selection highlight rules.
                if (edgeMatchesSearch) {
                  // Like a selected edge: strong, full opacity.
                  stroke = "hsl(var(--primary))";
                  strokeWidth = 2.2;
                  markerEnd = "url(#arrow-active)";
                } else if (edgeNeighborsMatchedNode) {
                  // Like an edge adjacent to a selected node: weak primary.
                  stroke = "hsl(var(--primary) / 0.5)";
                  strokeWidth = 1.3;
                  markerEnd = "url(#arrow-active)";
                } else {
                  opacity = 0.08;
                }
              } else if (selected) {
                stroke = "hsl(var(--primary))";
                strokeWidth = 2.2;
                markerEnd = "url(#arrow-active)";
              } else if (selectedEdge) {
                opacity = 0.12;
              } else if (selectedId) {
                if (relatedToSelectedNode) {
                  stroke = "hsl(var(--primary) / 0.5)";
                  strokeWidth = 1.3;
                  markerEnd = "url(#arrow-active)";
                } else {
                  opacity = 0.14;
                }
              }

              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const showLabel = selected || edgeMatchesSearch || edgeNeighborsMatchedNode || (!!selectedId && relatedToSelectedNode);
              return (
                <g
                  key={key}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeKey(key);
                    onSelect(null);
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <path
                    d={curvedEdgePath(a.x, a.y, b.x, b.y, key)}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    fill="none"
                    markerEnd={markerEnd}
                    opacity={opacity}
                  />
                  {showLabel && (
                    <text
                      x={mx}
                      y={my - 4}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize="8"
                      fill={selected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.8)"}
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const sel = n.id === selectedId;
              const relatedToSelectedNode = isNodeRelatedToSelectedNode(n.id);
              const relatedToSelectedEdge = isNodeRelatedToSelectedEdge(n.id);
              const { fill, stroke: baseStroke } = colorForType(n.type);

              let opacity = 1;
              let stroke = baseStroke;

              if (searchMatches) {
                // Search is active: mirror selection highlight rules.
                const isDirectMatch = searchMatches.directNodeIds.has(n.id);
                const isNeighbor = searchMatches.neighborNodeIds.has(n.id);
                const isEdgeEndpoint = searchMatches.edgeEndpointNodeIds.has(n.id);

                if (isDirectMatch) {
                  // Like a selected node: full opacity, type-specific color.
                  opacity = 1;
                } else if (isNeighbor) {
                  // Like a neighbor of selected node: slightly dimmed, weak stroke.
                  opacity = 0.72;
                  stroke = "hsl(var(--primary) / 0.6)";
                } else if (isEdgeEndpoint) {
                  // Like an endpoint of a selected edge: slightly dimmed, weak stroke.
                  opacity = 0.65;
                  stroke = "hsl(var(--primary) / 0.6)";
                } else {
                  opacity = 0.08;
                }
              } else if (sel) {
                stroke = "hsl(var(--primary))";
              } else if (selectedEdge) {
                opacity = relatedToSelectedEdge ? 0.65 : 0.16;
                if (relatedToSelectedEdge) stroke = "hsl(var(--primary) / 0.6)";
              } else if (selectedId) {
                opacity = relatedToSelectedNode ? 0.72 : 0.2;
                if (relatedToSelectedNode) stroke = "hsl(var(--primary) / 0.6)";
              }

              return (
                <g
                  key={n.id}
                  onClick={() => {
                    setSelectedEdgeKey(null);
                    onSelect(n.id);
                    setPanelVisible(true);
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    modeRef.current = "drag";
                    activePointerRef.current = event.pointerId;
                    draggedNodeIdRef.current = n.id;
                    didDragNodeRef.current = false;
                    lastPointerRef.current = { x: event.clientX, y: event.clientY };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  className="cursor-pointer"
                  opacity={opacity}
                >
                  {sel && (
                    <circle cx={n.x} cy={n.y} r={20} fill="none" stroke={stroke} strokeWidth="1" opacity="0.4">
                      <animate attributeName="r" values="14;22;14" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={n.x} cy={n.y} r={sel ? 10 : 7.5} fill={fill} stroke={stroke} strokeWidth={sel ? 2.5 : 1.5} />
                  <text
                    x={n.x}
                    y={n.y + 20}
                    textAnchor="middle"
                    fontSize="10"
                    className="font-mono"
                    fill={sel ? stroke : "hsl(var(--muted-foreground))"}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass rounded-md px-2.5 py-1.5 flex items-center gap-3 text-[10px] font-mono">
        {Array.from(new Set(nodes.map((n) => typeDisplay(n.type))))
          .slice(0, 4)
          .map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colorForType(t).stroke }} />
              {splitCamelCase(t)}
            </span>
          ))}
      </div>

      <div className="absolute bottom-3 right-3 glass rounded-md px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
        {nodes.length} nodes · {graphData.edges.length} edges · zoom {zoom.toFixed(2)}x · rot {rotationDeg.toFixed(0)}° · {physicsEnabled ? "live" : "frozen"}
      </div>
    </div>
  );
};
