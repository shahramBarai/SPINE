// --- Service Functions (use CRUD style naming) ---

import z from "zod";
import { fusekiClient } from "../db/client";
import { FusekiSparqlError } from "../db/fuseki";
import { uri_to_id } from "../utils";

interface IfcNode {
    id: string;
    label?: string;
    type: string;
    children: IfcNode[];
}

/* ------------------------------------------------------- */
/* ------ Service Functions (use CRUD style naming) ------ */
/* ------------------------------------------------------- */

const treeQueryResultSchema = z.array(
    z.object({
        node: z.object({
            type: z.string(),
            value: z.string()
        }),
        label: z
            .object({
                type: z.string(),
                value: z.string()
            })
            .optional(),
        type: z.object({
            type: z.string(),
            value: z.string()
        }),
        parent: z
            .object({
                type: z.string(),
                value: z.string()
            })
            .optional()
    })
);

// Shared by get_tree (one named graph, `<uri>`) and get_root_id (every named
// graph in the dataset, `?g`) - same shape of query and tree assembly,
// differing only in how much of the dataset the GRAPH clause covers.
async function queryTreeRoots(
    datasetName: string,
    graphPattern: string
): Promise<IfcNode[]> {
    const query = `
            PREFIX bot: <https://w3id.org/bot#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT ?node ?label ?type ?parent
            WHERE {
                GRAPH ${graphPattern} {
                    ?node a ?type .
                    FILTER (?type IN (bot:Site, bot:Building, bot:Storey, bot:Space))
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL {
                        ?parent (bot:hasBuilding | bot:hasStorey | bot:hasSpace | bot:containsZone) ?node .
                    }
                }
            }
        `;

    const buindings = await fusekiClient.sparql_query(
        datasetName,
        query,
        treeQueryResultSchema
    );

    const nodesById = new Map<string, IfcNode>();
    const childToParent = new Map<string, string>();

    // --- PASS 1: Single loop to extract unique nodes and record parent links ---
    for (const row of buindings) {
        const node_id = uri_to_id(row.node.value);
        if (!nodesById.has(node_id)) {
            nodesById.set(node_id, {
                id: node_id,
                label: row.label?.value,
                type: uri_to_id(row.type.value),
                children: []
            });
        }

        if (row.parent) {
            const parent_id = uri_to_id(row.parent.value);
            if (parent_id !== node_id) {
                childToParent.set(node_id, parent_id);
            }
        }
    }

    // --- PASS 2: Assemble the tree and isolate roots ---
    const roots: IfcNode[] = [];
    for (const [node_id, node] of nodesById) {
        const parent_id = childToParent.get(node_id);
        const parentNode = parent_id ? nodesById.get(parent_id) : undefined;
        if (parentNode) {
            // Because objects are passed by reference, pushing to a parent's
            // children array updates it everywhere automatically.
            parentNode.children.push(node);
        } else {
            // If it has no parent, or its parent wasn't in the queried scope, it's a root.
            roots.push(node);
        }
    }
    return roots;
}

/**
 * Retrieves a tree structure of nodes from the specified named graph.
 *
 * @param datasetName The name of the dataset to query.
 * @param graphUri The named graph to search.
 * @returns A list of IfcNode objects representing the tree structure of nodes.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function get_tree(
    datasetName: string,
    graphUri: string
): Promise<IfcNode[]> {
    return queryTreeRoots(datasetName, `<${graphUri}>`);
}

/**
 * Resolves the project's default relationship-graph focus: the id of the
 * first root node (a bot:Site/Building/Storey/Space with no parent) found
 * across every named graph in the dataset, i.e. project-wide rather than
 * scoped to one synced file.
 *
 * @param datasetName The name of the dataset to query.
 * @returns The short local id of a root node.
 * @throws FusekiSparqlError (status 404) if the dataset has no synced graph data yet, or if the server returns an error status code or there's a network error.
 */
async function get_root_id(datasetName: string): Promise<string> {
    const roots = await queryTreeRoots(datasetName, "?g");
    const rootId = roots[0]?.id;

    if (!rootId) {
        throw new FusekiSparqlError(
            `No root node found for dataset: ${datasetName}`,
            404
        );
    }

    return rootId;
}

/* ------------------------------------------------------- */
/* --------------- Relationship Graph --------------------- */
/* ------------------------------------------------------- */

type RelationshipNode = { id: string; label: string; type: string };
type RelationshipEdge = { from_id: string; to_id: string; label: string };
type RelationshipGraph = {
    nodes: RelationshipNode[];
    edges: RelationshipEdge[];
};
type RelationshipGraphFilters = {
    includeNodeTypes?: string[];
    includePredicates?: string[];
};

function sparqlStringLiteral(value: string): string {
    const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
    return `"${escaped}"`;
}

function includeListLiteral(values: string[]): string {
    return values.map(sparqlStringLiteral).join(", ");
}

// Filters a triple's own predicate by short local name - a plain FILTER is
// safe here since a triple pattern binds ?predicate to exactly one value
// per row (no multiplicity to worry about).
function predicateIncludeClause(includePredicates?: string[]): string {
    if (!includePredicates || includePredicates.length === 0) {
        return "";
    }
    return `
                    BIND(REPLACE(STR(?predicate), "^.*[#/]", "") AS ?predicateName)
                    FILTER(?predicateName IN (${includeListLiteral(includePredicates)}))`;
}

// Gates ?node by "has at least one rdf:type whose short name is allow-
// listed", via FILTER EXISTS - a boolean check rather than an extra SELECT
// variable, so it can't multiply result rows for a multi-typed node the way
// an extra OPTIONAL ?type binding would, and (unlike OPTIONAL+FILTER) can
// actually reject a row rather than just leave a variable unbound.
function nodeTypeIncludeClause(includeNodeTypes?: string[]): string {
    if (!includeNodeTypes || includeNodeTypes.length === 0) {
        return "";
    }
    return `
                    FILTER EXISTS {
                        ?node a ?filterNodeType .
                        BIND(REPLACE(STR(?filterNodeType), "^.*[#/]", "") AS ?filterNodeTypeName)
                        FILTER(?filterNodeTypeName IN (${includeListLiteral(includeNodeTypes)}))
                    }`;
}

const resolveFocusQueryResultSchema = z.array(
    z.object({ node: z.object({ type: z.string(), value: z.string() }) })
);

// The rest of the app (get_tree, the Fuseki tree sidebar, focusObjectId)
// identifies nodes by their short local name (e.g. "building_<uuid>"), not
// their full URI - so focusId is looked up here by matching that name
// against the end of a node's URI, scoped to the one graph being queried
// (kept cheap by staying within a single graph rather than scanning the
// whole dataset).
async function resolve_focus_uri(
    datasetName: string,
    graphUri: string,
    focusId: string
): Promise<string> {
    const query = `
        SELECT ?node WHERE {
            GRAPH <${graphUri}> {
                ?node ?p ?o .
                FILTER(
                    STRENDS(STR(?node), ${sparqlStringLiteral(`/${focusId}`)}) ||
                    STRENDS(STR(?node), ${sparqlStringLiteral(`#${focusId}`)})
                )
            }
        }
        LIMIT 1
    `;

    const rows = await fusekiClient.sparql_query(
        datasetName,
        query,
        resolveFocusQueryResultSchema
    );

    const resolved = rows[0]?.node.value;
    if (!resolved) {
        // Treated the same as a missing dataset: the graph has no matching
        // node, either because it's empty (TTL not synced yet) or focusId
        // doesn't exist in it - both mean "no data yet" to the caller.
        throw new FusekiSparqlError(`Focus node not found: ${focusId}`, 404);
    }
    return resolved;
}

const neighborQueryResultSchema = z.array(
    z.object({
        node: z.object({ type: z.string(), value: z.string() }),
        label: z.object({ type: z.string(), value: z.string() }).optional(),
        type: z.object({ type: z.string(), value: z.string() }).optional(),
        predicate: z.object({ type: z.string(), value: z.string() }).optional(),
        direction: z.object({ type: z.string(), value: z.string() }).optional()
    })
);

/**
 * Retrieves the focus node plus its direct neighbors (one hop out) from a
 * single named graph - deliberately simple, mirroring get_tree's shape of
 * "one query, then a small pass in JS", rather than a multi-hop traversal.
 *
 * @param datasetName The name of the dataset to query.
 * @param graphUri The named graph to search (as with get_tree, exactly one).
 * @param focusId The node to center the graph on - its short local id (matching get_tree/focusObjectId).
 * @param filters Optional include-only allow-lists (by short local name) for neighbor node types and/or the predicates connecting them. The focus node itself is never filtered out.
 * @throws FusekiSparqlError (status 404) if focusId can't be resolved to a node in this graph, or if the server returns an error status code or there's a network error.
 */
async function get_relationship_graph(
    datasetName: string,
    graphUri: string,
    focusId: string,
    filters?: RelationshipGraphFilters
): Promise<RelationshipGraph> {
    const focusUri = await resolve_focus_uri(datasetName, graphUri, focusId);
    const predicateFilter = predicateIncludeClause(filters?.includePredicates);
    const nodeTypeFilter = nodeTypeIncludeClause(filters?.includeNodeTypes);

    const query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?node ?label ?type ?predicate ?direction WHERE {
            GRAPH <${graphUri}> {
                {
                    BIND(<${focusUri}> AS ?node)
                }
                UNION
                {
                    <${focusUri}> ?predicate ?node .
                    FILTER(isIRI(?node) && ?predicate != rdf:type)
                    BIND("out" AS ?direction)
                    ${predicateFilter}
                    ${nodeTypeFilter}
                }
                UNION
                {
                    ?node ?predicate <${focusUri}> .
                    FILTER(isIRI(?node) && ?predicate != rdf:type)
                    BIND("in" AS ?direction)
                    ${predicateFilter}
                    ${nodeTypeFilter}
                }
                OPTIONAL { ?node rdfs:label ?label }
                OPTIONAL { ?node a ?type }
            }
        }
    `;

    const rows = await fusekiClient.sparql_query(
        datasetName,
        query,
        neighborQueryResultSchema
    );

    const nodesById = new Map<string, RelationshipNode>();
    const edgesByKey = new Map<string, RelationshipEdge>();

    for (const row of rows) {
        const id = uri_to_id(row.node.value);
        const existing = nodesById.get(id);
        nodesById.set(id, {
            id,
            label: row.label?.value ?? existing?.label ?? id,
            type: row.type ? uri_to_id(row.type.value) : (existing?.type ?? "")
        });

        if (row.predicate && row.direction) {
            const edge: RelationshipEdge =
                row.direction.value === "out"
                    ? {
                          from_id: uri_to_id(focusUri),
                          to_id: id,
                          label: uri_to_id(row.predicate.value)
                      }
                    : {
                          from_id: id,
                          to_id: uri_to_id(focusUri),
                          label: uri_to_id(row.predicate.value)
                      };
            edgesByKey.set(`${edge.from_id}|${edge.label}|${edge.to_id}`, edge);
        }
    }

    return {
        nodes: Array.from(nodesById.values()),
        edges: Array.from(edgesByKey.values())
    };
}

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { get_tree, get_root_id, get_relationship_graph };
export type {
    RelationshipNode,
    RelationshipEdge,
    RelationshipGraph,
    RelationshipGraphFilters
};
