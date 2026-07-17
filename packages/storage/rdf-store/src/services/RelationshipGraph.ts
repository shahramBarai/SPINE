// --- Service Functions (use CRUD style naming) ---

import z from "zod";
import { fusekiClient } from "../db/client";
import { FusekiSparqlError } from "../db/fuseki";
import {
    uri_to_id,
    sparqlStringLiteral,
    graphValuesClause,
    uri_to_type
} from "../utils";
import { findSameAsPairs } from "./sameAs";

type RelationshipNode = {
    id: string;
    label: string;
    type: string;
    sameAsIds: string[];
};
type RelationshipEdge = { from_id: string; to_id: string; label: string };
type RelationshipGraph = {
    nodes: RelationshipNode[];
    edges: RelationshipEdge[];
};
type RelationshipGraphFilters = {
    includeNodeTypes?: string[];
    excludeNodeTypes?: string[];
    includePredicates?: string[];
};

function includeListLiteral(values: string[]): string {
    return values.map(sparqlStringLiteral).join(", ");
}

// Filters a triple's own predicate by short local name.
//
// A plain FILTER is safe here since a triple pattern binds ?predicate to
// exactly one value per row (no multiplicity to worry about).
function predicateIncludeClause(includePredicates?: string[]): string {
    if (!includePredicates || includePredicates.length === 0) {
        return "";
    }
    return `
                    BIND(REPLACE(STR(?predicate), "^.*[#/]", "") AS ?predicateName)
                    FILTER(?predicateName IN (${includeListLiteral(includePredicates)}))`;
}

// Gates ?node to those with an allow-listed rdf:type.
//
// Uses FILTER EXISTS rather than an extra OPTIONAL ?type binding, so a
// multi-typed node can't multiply result rows, and a non-matching node is
// actually rejected rather than left with an unbound variable.
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

// Inverse of nodeTypeIncludeClause: rejects ?node if it has an
// excluded rdf:type (e.g. the bulk "Element" leaf type), via the same
// FILTER NOT EXISTS reasoning. Never applied to the focus node itself.
function nodeTypeExcludeClause(excludeNodeTypes?: string[]): string {
    if (!excludeNodeTypes || excludeNodeTypes.length === 0) {
        return "";
    }
    return `
                    FILTER NOT EXISTS {
                        ?node a ?excludedNodeType .
                        BIND(REPLACE(STR(?excludedNodeType), "^.*[#/]", "") AS ?excludedNodeTypeName)
                        FILTER(?excludedNodeTypeName IN (${includeListLiteral(excludeNodeTypes)}))
                    }`;
}

const resolveFocusQueryResultSchema = z.array(
    z.object({ node: z.object({ type: z.string(), value: z.string() }) })
);

/**
 * Resolves a short local id (e.g. "building_<uuid>") to its full node URI.
 *
 * The rest of the app (get_tree, the Fuseki tree sidebar, focusObjectId)
 * identifies nodes by this short name rather than their full URI, so it's
 * matched here against the end of a node's URI - scoped to the given
 * graphs to keep the scan cheap.
 *
 * @param datasetName The name of the dataset to query.
 * @param graphUris The named graphs to search.
 * @param focusId The short local id to resolve.
 * @returns The full URI of the matching node.
 * @throws FusekiSparqlError (status 404) if no node matches, or if the server returns an error status code or there's a network error.
 */
async function resolve_focus_uri(
    datasetName: string,
    graphUris: string[],
    focusId: string
): Promise<string> {
    const query = `
        SELECT ?node WHERE {
            ${graphValuesClause(graphUris)}
            GRAPH ?g {
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

// Collapses neighbor nodes that are owl:sameAs-equivalent to each other
// into a single RelationshipNode - otherwise the same building/storey/etc.
// comes back once per discipline, with matching or near-matching labels
// and no indication they're the same thing. The focus node's own id is
// always kept as its cluster's canonical id, since edges are anchored
// there (see get_relationship_graph); other clusters pick deterministically
// (lowest id) rather than by query result order.
async function mergeSameAsEquivalentNodes(
    datasetName: string,
    graphUris: string[],
    nodesById: Map<string, RelationshipNode>,
    nodeUriById: Map<string, string>,
    edgesByKey: Map<string, RelationshipEdge>,
    focusShortId: string
): Promise<RelationshipGraph> {
    const pairs = await findSameAsPairs(
        datasetName,
        graphUris,
        Array.from(nodeUriById.values())
    );

    const parent = new Map<string, string>();
    const find = (id: string): string => {
        let root = parent.get(id) ?? id;
        while (parent.has(root) && parent.get(root) !== root) {
            root = parent.get(root)!;
        }
        parent.set(id, root);
        return root;
    };
    const union = (a: string, b: string) => {
        if (!nodesById.has(a) || !nodesById.has(b)) {
            return;
        }
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB) {
            return;
        }
        if (rootA === focusShortId) {
            parent.set(rootB, rootA);
        } else if (rootB === focusShortId) {
            parent.set(rootA, rootB);
        } else if (rootA < rootB) {
            parent.set(rootB, rootA);
        } else {
            parent.set(rootA, rootB);
        }
    };

    for (const pair of pairs) {
        union(uri_to_id(pair.a), uri_to_id(pair.b));
    }

    const clusters = new Map<string, string[]>();
    for (const id of nodesById.keys()) {
        const root = find(id);
        const members = clusters.get(root) ?? [];
        members.push(id);
        clusters.set(root, members);
    }

    const mergedNodesById = new Map<string, RelationshipNode>();
    const canonicalIdByOriginal = new Map<string, string>();

    for (const [canonicalId, members] of clusters) {
        for (const memberId of members) {
            canonicalIdByOriginal.set(memberId, canonicalId);
        }

        const memberNodes = members.map((id) => nodesById.get(id)!);
        // Prefer a member that actually has a real rdfs:label (rows without
        // one fell back to their own id - see the caller) over one that
        // doesn't, same idea for type.
        const label =
            memberNodes.find((n) => n.label !== n.id)?.label ??
            memberNodes[0]!.label;
        const type = memberNodes.find((n) => n.type)?.type ?? "";

        mergedNodesById.set(canonicalId, {
            id: canonicalId,
            label,
            type,
            sameAsIds: members.filter((id) => id !== canonicalId)
        });
    }

    const mergedEdgesByKey = new Map<string, RelationshipEdge>();
    for (const edge of edgesByKey.values()) {
        const from_id = canonicalIdByOriginal.get(edge.from_id) ?? edge.from_id;
        const to_id = canonicalIdByOriginal.get(edge.to_id) ?? edge.to_id;
        if (from_id === to_id) {
            // A neighbor that turned out to be sameAs-equivalent to the
            // focus itself collapses to a self-loop - not a real edge.
            continue;
        }
        const key = `${from_id}|${edge.label}|${to_id}`;
        mergedEdgesByKey.set(key, { from_id, to_id, label: edge.label });
    }

    return {
        nodes: Array.from(mergedNodesById.values()),
        edges: Array.from(mergedEdgesByKey.values())
    };
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
 * Retrieves the focus node plus its direct neighbors (one hop out),
 * searched across every graph passed in.
 *
 * owl:sameAs edges are treated as transparent: the focus node is first
 * walked through its sameAs-equivalent nodes (zero or more hops, either
 * direction) before collecting neighbors, so a bare identity pointer never
 * shows up as a dead-end edge. Each hop, and each neighbor lookup, may land
 * in a different visible graph (e.g. a Linkset graph bridging disciplines).
 *
 * @param datasetName The name of the dataset to query.
 * @param graphUris The named graphs to search.
 * @param focusId The node to center the graph on - its short local id (matching get_tree/focusObjectId).
 * @param filters Optional include/exclude allow- and deny-lists (by short local name) for neighbor node types, and an allow-list for the predicates connecting them. The focus node itself is never filtered out.
 * @throws FusekiSparqlError (status 404) if focusId can't be resolved to a node in these graphs, or if the server returns an error status code or there's a network error.
 */
async function get_relationship_graph(
    datasetName: string,
    graphUris: string[],
    focusId: string,
    filters?: RelationshipGraphFilters
): Promise<RelationshipGraph> {
    const focusUri = await resolve_focus_uri(datasetName, graphUris, focusId);
    const predicateFilter = predicateIncludeClause(filters?.includePredicates);
    const nodeTypeFilter = nodeTypeIncludeClause(filters?.includeNodeTypes);
    const nodeTypeExcludeFilter = nodeTypeExcludeClause(
        filters?.excludeNodeTypes
    );
    // The sameAs walk and the neighbor lookup are independently-scoped graph
    // choices (see graphValuesClause), so a hop through a Linkset graph can
    // land on a neighbor triple that only exists in a different file's graph.
    const sameAsHop = `${graphValuesClause(graphUris, "sameG")}
                    GRAPH ?sameG { <${focusUri}> (owl:sameAs|^owl:sameAs)* ?same }`;

    const query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX owl: <http://www.w3.org/2002/07/owl#>

        SELECT ?node ?label ?type ?predicate ?direction WHERE {
            {
                BIND(<${focusUri}> AS ?node)
            }
            UNION
            {
                ${sameAsHop}
                ${graphValuesClause(graphUris, "g")}
                GRAPH ?g {
                    ?same ?predicate ?node .
                    FILTER(isIRI(?node) && ?predicate NOT IN (rdf:type, owl:sameAs))
                    BIND("out" AS ?direction)
                    ${predicateFilter}
                    ${nodeTypeFilter}
                    ${nodeTypeExcludeFilter}
                }
            }
            UNION
            {
                ${sameAsHop}
                ${graphValuesClause(graphUris, "g")}
                GRAPH ?g {
                    ?node ?predicate ?same .
                    FILTER(isIRI(?node) && ?predicate NOT IN (rdf:type, owl:sameAs))
                    BIND("in" AS ?direction)
                    ${predicateFilter}
                    ${nodeTypeFilter}
                    ${nodeTypeExcludeFilter}
                }
            }
            OPTIONAL {
                ${graphValuesClause(graphUris, "labelG")}
                GRAPH ?labelG { ?node rdfs:label ?label }
            }
            OPTIONAL {
                ${graphValuesClause(graphUris, "typeG")}
                GRAPH ?typeG { ?node a ?type }
            }
        }
    `;

    const rows = await fusekiClient.sparql_query(
        datasetName,
        query,
        neighborQueryResultSchema
    );

    const nodesById = new Map<string, RelationshipNode>();
    const nodeUriById = new Map<string, string>();
    const edgesByKey = new Map<string, RelationshipEdge>();

    for (const row of rows) {
        const id = uri_to_id(row.node.value);
        const existing = nodesById.get(id);
        nodeUriById.set(id, row.node.value);
        nodesById.set(id, {
            id,
            label: row.label?.value ?? existing?.label ?? id,
            type: row.type
                ? uri_to_type(row.type.value)
                : (existing?.type ?? "Unkown"),
            sameAsIds: []
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

    return mergeSameAsEquivalentNodes(
        datasetName,
        graphUris,
        nodesById,
        nodeUriById,
        edgesByKey,
        uri_to_id(focusUri)
    );
}

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { get_relationship_graph };
export type {
    RelationshipNode,
    RelationshipEdge,
    RelationshipGraph,
    RelationshipGraphFilters
};
