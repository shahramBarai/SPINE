import { projectTree, sensors, triples, type IfcNode, type Sensor, type Triple } from "@/lib/twin-data";

const apiBase = (import.meta.env.VITE_BUILDING_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:8000/api";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitForApiHealth = async (retries = 20, intervalMs = 500): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${apiBase}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Retry until backend becomes available.
    }
    await sleep(intervalMs);
  }
  return false;
};

const tryStartBackendViaVite = async (): Promise<boolean> => {
  if (!import.meta.env.DEV) {
    return false;
  }

  try {
    const response = await fetch("/__dev/start-building-api", { method: "POST" });
    if (!response.ok) {
      return false;
    }
  } catch {
    return false;
  }

  return waitForApiHealth();
};

const toReadableFetchError = (error: unknown): Error => {
  if (error instanceof TypeError) {
    return new Error(
      `Cannot reach Building API at ${apiBase}. Check that backend is running and CORS allows this frontend origin.`
    );
  }

  return error instanceof Error ? error : new Error("Unknown network error");
};

const fetchJson = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`);
  } catch (error) {
    const started = await tryStartBackendViaVite();
    if (!started) {
      throw toReadableFetchError(error);
    }

    try {
      response = await fetch(`${apiBase}${path}`);
    } catch (retryError) {
      throw toReadableFetchError(retryError);
    }
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

const postJson = async <TResponse, TBody>(path: string, body: TBody): Promise<TResponse> => {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const started = await tryStartBackendViaVite();
    if (!started) {
      throw toReadableFetchError(error);
    }

    try {
      response = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (retryError) {
      throw toReadableFetchError(retryError);
    }
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TResponse>;
};

export type PipelineRequest = {
  file?: string;
  dir?: string;
  fuseki_graph?: string;
  fuseki_graph_template?: string;
  fuseki_replace?: boolean;
};

export type IfcScanResult = {
  count: number;
  files: string[];
};

export type PipelineFileResult = {
  source_file: string;
  target_ttl: string;
  converted: boolean;
  uploaded: boolean;
  error?: string;
};

export type PipelineResult = {
  processed: number;
  successful: number;
  results: PipelineFileResult[];
};

export type GraphNode = {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
};

export type GraphEdge = {
  from_id: string;
  to_id: string;
  label: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type ServiceHealth = {
  connected: boolean;
  container_status?: string | null;
  health_status?: string | null;
  error?: string | null;
};

export type ApiHealth = {
  status: string;
  timescaledb: ServiceHealth;
};

export type EntityProperty = {
  property: string;
  value: string;
};

export type SemanticSearchRequest = {
  query: string;
  limit?: number;
  focus_id?: string | null;
};

export type SemanticSearchResult = {
  triples: Triple[];
  graph: GraphData;
};

const uriToId = (uri: string): string => {
  if (!uri) return "";
  if (uri.includes("#")) return uri.split("#").pop() ?? "";
  if (uri.includes("/")) return uri.split("/").pop() ?? "";
  return uri;
};

const shortName = (uri: string): string => uriToId(uri).replace(/_/g, " ");

const RDF_TYPE_PREDICATE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const edgeLabel = (predicateUri: string): string => {
  const value = predicateUri.trim();
  const knownPrefixes: Array<{ ns: string; prefix: string }> = [
    { ns: "https://w3id.org/bot#", prefix: "bot" },
    { ns: "http://w3id.org/bot#", prefix: "bot" },
    { ns: "https://brickschema.org/schema/Brick#", prefix: "brick" },
    { ns: "https://brickschema.org/schema/brick#", prefix: "brick" },
    { ns: "http://data.ashrae.org/standard223#", prefix: "s223" },
    { ns: "https://w3id.org/fso#", prefix: "fso" },
    { ns: "http://w3id.org/fso#", prefix: "fso" },
    { ns: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", prefix: "rdf" },
    { ns: "http://www.w3.org/2000/01/rdf-schema#", prefix: "rdfs" },
    { ns: "http://www.w3.org/2002/07/owl#", prefix: "owl" },
  ];

  for (const entry of knownPrefixes) {
    if (value.startsWith(entry.ns)) {
      return `${entry.prefix}:${value.slice(entry.ns.length)}`;
    }
  }

  return uriToId(value);
};

const isRdfTypePredicate = (predicateUri: string): boolean => {
  const value = predicateUri.trim().toLowerCase();
  return value === RDF_TYPE_PREDICATE || value === "rdf:type" || value.endsWith("#type") || value.endsWith("/type");
};

const formatRdfTypeValue = (value: string): string => {
  if (!value) return "Unknown";
  return value.startsWith("http://") || value.startsWith("https://") ? edgeLabel(value) : value;
};

const isUnknownNodeType = (value: string): boolean => !value || value.trim() === "" || value.trim() === "Unknown";

const isRdfsLabelPredicate = (predicateUri: string): boolean => {
  const value = predicateUri.trim().toLowerCase();
  return value === "http://www.w3.org/2000/01/rdf-schema#label" || value.endsWith("#label") || value.endsWith("/label");
};

const decodeNTripleLiteral = (rawObject: string): string | null => {
  const match = rawObject.match(/^"((?:[^"\\]|\\.)*)"(?:@[a-z0-9-]+|\^\^<[^>]+>)?$/i);
  if (!match) {
    return null;
  }

  return match[1]
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
};

const layout = (index: number, total: number): { x: number; y: number } => {
  if (total <= 0) return { x: 350, y: 210 };
  const centerX = 350;
  const centerY = 210;
  const radius = 140 + (index % 3) * 35;
  const angle = (index / total) * (Math.PI * 2);
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
};

type SparqlBinding = Record<string, { type?: string; value?: string }>;

const bindingValue = (row: SparqlBinding, key: string): string => row[key]?.value ?? "";

const bindingType = (row: SparqlBinding, key: string): string => row[key]?.type ?? "";

const parseTriplesFromBindings = (bindings: SparqlBinding[], maxCount: number): { triples: Triple[]; graph: GraphData } => {
  const triples: Triple[] = [];
  const graphNodes = new Map<string, GraphNode>();
  const graphEdges: GraphEdge[] = [];
  const nodeIdToUri = new Map<string, string>();
  const labelByUri = new Map<string, string>();
  const rdfTypeByUri = new Map<string, string>();
  let acceptedTriples = 0;

  for (const row of bindings) {
    const subject = bindingValue(row, "s") || bindingValue(row, "subject");
    const predicate = bindingValue(row, "p") || bindingValue(row, "predicate");
    const object = bindingValue(row, "o") || bindingValue(row, "object");
    const objectType = bindingType(row, "o") || bindingType(row, "object");

    if (!subject || !predicate || !object) {
      continue;
    }

    const includeInGraph = acceptedTriples < maxCount;
    if (includeInGraph) {
      triples.push({ subject, predicate, object });
      acceptedTriples += 1;
    }

    if (isRdfsLabelPredicate(predicate) && objectType === "literal") {
      labelByUri.set(subject, object);
    }

    if (isRdfTypePredicate(predicate)) {
      rdfTypeByUri.set(subject, formatRdfTypeValue(object));
    }

    const explicitLabel = bindingValue(row, "label");
    if (explicitLabel) {
      labelByUri.set(subject, explicitLabel);
    }

    if (!includeInGraph) {
      continue;
    }

    const objectIsNode = objectType === "uri" || objectType === "bnode";
    if (!objectIsNode) {
      continue;
    }

    const fromId = uriToId(subject);
    const toId = uriToId(object);
    if (!fromId || !toId) {
      continue;
    }

    graphEdges.push({ from_id: fromId, to_id: toId, label: edgeLabel(predicate) });

    if (!graphNodes.has(fromId)) {
      graphNodes.set(fromId, {
        id: fromId,
        label: labelByUri.get(subject) ?? shortName(subject),
        type: rdfTypeByUri.get(subject) ?? "Unknown",
        x: 0,
        y: 0,
      });
      nodeIdToUri.set(fromId, subject);
    }

    if (!graphNodes.has(toId)) {
      graphNodes.set(toId, {
        id: toId,
        label: labelByUri.get(object) ?? shortName(object),
        type: rdfTypeByUri.get(object) ?? "Unknown",
        x: 0,
        y: 0,
      });
      nodeIdToUri.set(toId, object);
    }
  }

  const nodes = Array.from(graphNodes.values());
  for (const node of nodes) {
    const uri = nodeIdToUri.get(node.id);
    if (!uri) {
      continue;
    }
    const labeled = labelByUri.get(uri);
    if (labeled) {
      node.label = labeled;
    }
    const typed = rdfTypeByUri.get(uri);
    if (typed) {
      node.type = typed;
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const { x, y } = layout(i, nodes.length);
    nodes[i].x = x;
    nodes[i].y = y;
  }

  return { triples, graph: { nodes, edges: graphEdges } };
};

const isLikelyUri = (value: string): boolean => {
  const lower = value.toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("urn:");
};

const collectNodeUrisFromTriples = (triples: Triple[]): string[] => {
  const uris = new Set<string>();

  for (const triple of triples) {
    if (isLikelyUri(triple.subject)) {
      uris.add(triple.subject);
    }
    if (isLikelyUri(triple.object)) {
      uris.add(triple.object);
    }
  }

  return Array.from(uris);
};

const fetchNodeLabels = async (uris: string[]): Promise<Map<string, string>> => {
  const labels = new Map<string, string>();
  if (!uris.length) {
    return labels;
  }

  const valuesClause = uris.map((uri) => `<${uri}>`).join(" ");
  const query = `
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?s ?label
WHERE {
  VALUES ?s { ${valuesClause} }
  ?s rdfs:label ?label .
}
`;

  const params = new URLSearchParams();
  params.set("query", query);

  const response = await fetch("/__fuseki/sparql", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    return labels;
  }

  const data = (await response.json()) as { results?: { bindings?: SparqlBinding[] } };
  const bindings = data.results?.bindings ?? [];
  for (const row of bindings) {
    const subject = bindingValue(row, "s");
    const label = bindingValue(row, "label");
    if (subject && label) {
      labels.set(subject, label);
    }
  }

  return labels;
};

const fetchNodeTypes = async (uris: string[]): Promise<Map<string, string>> => {
  const types = new Map<string, string>();
  if (!uris.length) {
    return types;
  }

  const valuesClause = uris.map((uri) => `<${uri}>`).join(" ");
  const query = `
SELECT ?s (SAMPLE(?t) AS ?type)
WHERE {
  VALUES ?s { ${valuesClause} }
  ?s <${RDF_TYPE_PREDICATE}> ?t .
}
GROUP BY ?s
`;

  const params = new URLSearchParams();
  params.set("query", query);

  const response = await fetch("/__fuseki/sparql", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    return types;
  }

  const data = (await response.json()) as { results?: { bindings?: SparqlBinding[] } };
  const bindings = data.results?.bindings ?? [];
  for (const row of bindings) {
    const subject = bindingValue(row, "s");
    const typeValue = bindingValue(row, "type");
    if (subject && typeValue) {
      types.set(subject, formatRdfTypeValue(typeValue));
    }
  }

  return types;
};

const fetchElementBatidLabels = async (uris: string[]): Promise<Map<string, string>> => {
  const labels = new Map<string, string>();
  if (!uris.length) {
    return labels;
  }

  const valuesClause = uris.map((uri) => `<${uri}>`).join(" ");
  const query = `
SELECT ?s (SAMPLE(?batidRaw) AS ?batid)
WHERE {
  VALUES ?s { ${valuesClause} }
  ?s ?p ?batidRaw .
  FILTER(STRENDS(STR(?p), "batid_attribute_simple"))
}
GROUP BY ?s
`;

  const params = new URLSearchParams();
  params.set("query", query);

  const response = await fetch("/__fuseki/sparql", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/sparql-results+json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    return labels;
  }

  const data = (await response.json()) as { results?: { bindings?: SparqlBinding[] } };
  const bindings = data.results?.bindings ?? [];
  for (const row of bindings) {
    const subject = bindingValue(row, "s");
    const batid = bindingValue(row, "batid");
    if (subject && batid) {
      labels.set(subject, batid);
    }
  }

  return labels;
};

const applyFetchedLabelsToGraph = (
  graph: GraphData,
  triples: Triple[],
  labelsByUri: Map<string, string>,
  elementBatidByUri: Map<string, string>
): GraphData => {
  if (!graph.nodes.length || (!labelsByUri.size && !elementBatidByUri.size)) {
    return graph;
  }

  const uriByNodeId = new Map<string, string>();
  for (const triple of triples) {
    if (isLikelyUri(triple.subject)) {
      uriByNodeId.set(uriToId(triple.subject), triple.subject);
    }
    if (isLikelyUri(triple.object)) {
      uriByNodeId.set(uriToId(triple.object), triple.object);
    }
  }

  const nodes = graph.nodes.map((node) => {
    const uri = uriByNodeId.get(node.id);
    if (!uri) {
      return node;
    }

    const label = labelsByUri.get(uri);
    const batidLabel = elementBatidByUri.get(uri);

    // Highest priority: props:batid_attribute_simple when present.
    if (batidLabel) {
      return { ...node, label: batidLabel };
    }

    if (!label) {
      return node;
    }

    return { ...node, label };
  });

  return { ...graph, nodes };
};

const applyFetchedTypesToGraph = (graph: GraphData, triples: Triple[], typesByUri: Map<string, string>): GraphData => {
  if (!graph.nodes.length || !typesByUri.size) {
    const classLikeUris = new Set<string>();
    for (const triple of triples) {
      if (isRdfTypePredicate(triple.predicate) && isLikelyUri(triple.object)) {
        classLikeUris.add(triple.object);
      }
    }

    if (!classLikeUris.size) {
      return graph;
    }

    const uriByNodeId = new Map<string, string>();
    for (const triple of triples) {
      if (isLikelyUri(triple.subject)) {
        uriByNodeId.set(uriToId(triple.subject), triple.subject);
      }
      if (isLikelyUri(triple.object)) {
        uriByNodeId.set(uriToId(triple.object), triple.object);
      }
    }

    const nodes = graph.nodes.map((node) => {
      const uri = uriByNodeId.get(node.id);
      if (!uri || !classLikeUris.has(uri) || !isUnknownNodeType(node.type)) {
        return node;
      }

      return { ...node, type: "owl:Class" };
    });

    return { ...graph, nodes };
  }

  const uriByNodeId = new Map<string, string>();
  const classLikeUris = new Set<string>();
  for (const triple of triples) {
    if (isLikelyUri(triple.subject)) {
      uriByNodeId.set(uriToId(triple.subject), triple.subject);
    }
    if (isLikelyUri(triple.object)) {
      uriByNodeId.set(uriToId(triple.object), triple.object);
    }
    if (isRdfTypePredicate(triple.predicate) && isLikelyUri(triple.object)) {
      classLikeUris.add(triple.object);
    }
  }

  const nodes = graph.nodes.map((node) => {
    const uri = uriByNodeId.get(node.id);
    if (!uri) {
      return node;
    }

    const type = typesByUri.get(uri);
    if (!type) {
      if (classLikeUris.has(uri) && isUnknownNodeType(node.type)) {
        return { ...node, type: "owl:Class" };
      }
      return node;
    }

    return { ...node, type };
  });

  return { ...graph, nodes };
};

const parseTriplesFromNTriples = (ntriples: string, maxCount: number): { triples: Triple[]; graph: GraphData } => {
  const triples: Triple[] = [];
  const graphNodes = new Map<string, GraphNode>();
  const graphEdges: GraphEdge[] = [];
  const nodeIdToUri = new Map<string, string>();
  const labelByUri = new Map<string, string>();
  const rdfTypeByUri = new Map<string, string>();
  let acceptedTriples = 0;

  const linePattern = /^\s*(<[^>]+>|_:[^\s]+)\s+(<[^>]+>)\s+(.+?)\s*\.\s*$/;

  for (const rawLine of ntriples.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(linePattern);
    if (!match) {
      continue;
    }

    const rawSubject = match[1];
    const rawPredicate = match[2];
    const rawObject = match[3];

    const subject = rawSubject.startsWith("<") ? rawSubject.slice(1, -1) : rawSubject;
    const predicate = rawPredicate.slice(1, -1);
    const object = rawObject.startsWith("<") ? rawObject.slice(1, -1) : rawObject;

    const includeInGraph = acceptedTriples < maxCount;
    if (includeInGraph) {
      triples.push({ subject, predicate, object });
      acceptedTriples += 1;
    }

    if (isRdfsLabelPredicate(predicate)) {
      const decodedLabel = decodeNTripleLiteral(rawObject);
      if (decodedLabel) {
        labelByUri.set(subject, decodedLabel);
      }
    }

    if (isRdfTypePredicate(predicate)) {
      const looksLikePrefixedType = /^[A-Za-z][A-Za-z0-9_-]*:[^\s]+$/.test(rawObject);
      if (rawObject.startsWith("<") || rawObject.startsWith("_:") || looksLikePrefixedType) {
        rdfTypeByUri.set(subject, formatRdfTypeValue(object));
      }
    }

    if (!includeInGraph) {
      continue;
    }

    const objectIsNode = rawObject.startsWith("<") || rawObject.startsWith("_:");
    if (!objectIsNode) {
      continue;
    }

    const fromId = uriToId(subject);
    const toId = uriToId(object);
    if (!fromId || !toId) {
      continue;
    }

    graphEdges.push({ from_id: fromId, to_id: toId, label: edgeLabel(predicate) });

    if (!graphNodes.has(fromId)) {
      graphNodes.set(fromId, {
        id: fromId,
        label: labelByUri.get(subject) ?? shortName(subject),
        type: rdfTypeByUri.get(subject) ?? "Unknown",
        x: 0,
        y: 0,
      });
      nodeIdToUri.set(fromId, subject);
    }

    if (!graphNodes.has(toId)) {
      graphNodes.set(toId, {
        id: toId,
        label: labelByUri.get(object) ?? shortName(object),
        type: rdfTypeByUri.get(object) ?? "Unknown",
        x: 0,
        y: 0,
      });
      nodeIdToUri.set(toId, object);
    }
  }

  const nodes = Array.from(graphNodes.values());
  for (const node of nodes) {
    const uri = nodeIdToUri.get(node.id);
    if (!uri) {
      continue;
    }
    const labeled = labelByUri.get(uri);
    if (labeled) {
      node.label = labeled;
    }
    const typed = rdfTypeByUri.get(uri);
    if (typed) {
      node.type = typed;
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    const { x, y } = layout(i, nodes.length);
    nodes[i].x = x;
    nodes[i].y = y;
  }

  return { triples, graph: { nodes, edges: graphEdges } };
};

const detectSparqlForm = (query: string): "select" | "construct" | "other" => {
  const withoutComments = query.replace(/#[^\n]*/g, " ");
  const match = withoutComments.match(/\b(select|construct|ask|describe)\b/i);
  if (!match) {
    return "other";
  }

  const keyword = match[1].toLowerCase();
  if (keyword === "select") return "select";
  if (keyword === "construct") return "construct";
  return "other";
};

export const fetchProjectTree = async (): Promise<IfcNode[]> => fetchJson<IfcNode[]>("/tree");

export const fetchSensors = async (): Promise<Sensor[]> => fetchJson<Sensor[]>("/sensors");

export const fetchTriples = async (): Promise<Triple[]> => fetchJson<Triple[]>("/triples");

export const fetchGraph = async (focusId?: string | null): Promise<GraphData> => {
  const suffix = focusId ? `?focus_id=${encodeURIComponent(focusId)}` : "";
  return fetchJson<GraphData>(`/graph${suffix}`);
};

export const fetchApiHealth = async (): Promise<ApiHealth> => fetchJson<ApiHealth>("/health");

export const loadIfc = async (request: Pick<PipelineRequest, "file" | "dir">): Promise<IfcScanResult> =>
  postJson<IfcScanResult, Pick<PipelineRequest, "file" | "dir">>("/pipeline/load-ifc", request);

export const convertIfcToTtl = async (request: PipelineRequest): Promise<PipelineResult> =>
  postJson<PipelineResult, PipelineRequest>("/pipeline/convert", request);

export const syncIfcToFuseki = async (request: PipelineRequest): Promise<PipelineResult> =>
  postJson<PipelineResult, PipelineRequest>("/pipeline/sync", request);

export type FusekiStatus = {
  connected: boolean;
  url: string;
};

export const fetchFusekiStatus = async (): Promise<FusekiStatus> =>
  fetchJson<FusekiStatus>("/fuseki/status");

export const runSemanticSearch = async (request: SemanticSearchRequest): Promise<SemanticSearchResult> => {
  const query = request.query.trim();
  if (!query) {
    throw new Error("SPARQL query is required.");
  }

  const form = detectSparqlForm(query);
  if (form === "other") {
    throw new Error("Only SPARQL SELECT and CONSTRUCT queries are supported.");
  }

  const params = new URLSearchParams();
  params.set("query", query);

  let response: Response;
  try {
    response = await fetch("/__fuseki/sparql", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: form === "construct" ? "application/n-triples" : "application/sparql-results+json",
      },
      body: params.toString(),
    });
  } catch {
    throw new Error("Cannot reach Fuseki query endpoint. Check that Fuseki is running.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}. ${errorBody}`);
  }

  const limit = request.limit ?? 500;
  const parsed =
    form === "construct"
      ? parseTriplesFromNTriples(await response.text(), limit)
      : parseTriplesFromBindings(
          ((await response.json()) as { results?: { bindings?: SparqlBinding[] } }).results?.bindings ?? [],
          limit
        );

  if (!parsed.triples.length) {
    throw new Error(
      form === "construct"
        ? "CONSTRUCT query returned no triples."
        : "Query must return variables (?s ?p ?o) or (?subject ?predicate ?object)."
    );
  }

  const nodeUris = collectNodeUrisFromTriples(parsed.triples);
  const [labelsByUri, elementBatidByUri, typesByUri] = await Promise.all([
    fetchNodeLabels(nodeUris),
    fetchElementBatidLabels(nodeUris),
    fetchNodeTypes(nodeUris),
  ]);

  if (!labelsByUri.size && !elementBatidByUri.size && !typesByUri.size) {
    return parsed;
  }

  const graphWithTypes = applyFetchedTypesToGraph(parsed.graph, parsed.triples, typesByUri);

  return {
    triples: parsed.triples,
    graph: applyFetchedLabelsToGraph(graphWithTypes, parsed.triples, labelsByUri, elementBatidByUri),
  };
};

export const fetchEntityProperties = async (entityUri: string): Promise<EntityProperty[]> => {
  if (!entityUri) {
    return [];
  }

  const query = `
SELECT ?property ?value
WHERE {
  <${entityUri}> ?property ?value .
}
ORDER BY ?property
`;

  const params = new URLSearchParams();
  params.set("query", query);

  try {
    const response = await fetch("/__fuseki/sparql", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { results?: { bindings?: SparqlBinding[] } };
    const bindings = data.results?.bindings ?? [];
    const properties: EntityProperty[] = [];

    for (const row of bindings) {
      const property = bindingValue(row, "property");
      const value = bindingValue(row, "value");
      if (property && value) {
        properties.push({ property, value });
      }
    }

    return properties;
  } catch {
    return [];
  }
};

export const fallbackTwinData = {
  projectTree,
  sensors,
  triples,
  graph: {
    nodes: [
      { id: "site-1", label: "Site", type: "ifc" as const, x: 50, y: 50 },
      { id: "bldg-a", label: "Building A", type: "ifc" as const, x: 50, y: 150 },
      { id: "storey-a-2", label: "Level 02", type: "ifc" as const, x: 200, y: 150 },
      { id: "space-a-2-1", label: "Workspace W", type: "ifc" as const, x: 350, y: 100 },
      { id: "space-a-2-2", label: "Workspace E", type: "ifc" as const, x: 350, y: 200 },
      { id: "elem-a-2-3", label: "AHU-02", type: "ifc" as const, x: 200, y: 280 },
      { id: "elem-a-3-2", label: "Chiller CH-301", type: "ifc" as const, x: 50, y: 280 },
      { id: "s-001", label: "TMP-A2-W", type: "iot" as const, x: 480, y: 60 },
      { id: "s-002", label: "CO2-A2-W", type: "iot" as const, x: 480, y: 130 },
      { id: "s-003", label: "OCC-A2-E", type: "iot" as const, x: 480, y: 220 },
      { id: "s-007", label: "PWR-AHU-02", type: "iot" as const, x: 320, y: 320 },
      { id: "s-004", label: "PWR-CH-301", type: "iot" as const, x: 50, y: 360 },
      { id: "saref", label: "saref:Property", type: "semantic" as const, x: 600, y: 140 },
    ],
    edges: [
      { from_id: "site-1", to_id: "bldg-a", label: "hasBuilding" },
      { from_id: "bldg-a", to_id: "storey-a-2", label: "hasStorey" },
      { from_id: "storey-a-2", to_id: "space-a-2-1", label: "hasSpace" },
      { from_id: "storey-a-2", to_id: "space-a-2-2", label: "hasSpace" },
      { from_id: "elem-a-3-2", to_id: "elem-a-2-3", label: "supplies" },
      { from_id: "elem-a-2-3", to_id: "storey-a-2", label: "serves" },
      { from_id: "space-a-2-1", to_id: "s-001", label: "measuredBy" },
      { from_id: "space-a-2-1", to_id: "s-002", label: "measuredBy" },
      { from_id: "space-a-2-2", to_id: "s-003", label: "measuredBy" },
      { from_id: "elem-a-2-3", to_id: "s-007", label: "monitoredBy" },
      { from_id: "elem-a-3-2", to_id: "s-004", label: "monitoredBy" },
      { from_id: "s-001", to_id: "saref", label: "type" },
      { from_id: "s-002", to_id: "saref", label: "type" },
    ],
  },
};
