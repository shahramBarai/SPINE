// --- Service Functions (use CRUD style naming) ---

import z from "zod";
import { fusekiClient } from "../db/client";
import { FusekiSparqlError } from "../db/fuseki";
import { uri_to_id, sparqlStringLiteral } from "../utils";

type RelationshipNode = { id: string; label: string; type: string };
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

// Restricts a graph variable to exactly the given named graphs, so
// `GRAPH ?varName { ... }` behaves like a UNION across them.
//
// Pass distinct varNames when a query needs two independently-chosen
// graphs (see get_relationship_graph's sameAs traversal).
function graphValuesClause(graphUris: string[], varName: string = "g"): string {
    const uris = graphUris.map((uri) => `<${uri}>`).join(" ");
    return `VALUES ?${varName} { ${uris} }`;
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
    const nodeTypeExcludeFilter = nodeTypeExcludeClause(filters?.excludeNodeTypes);
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
export { get_relationship_graph };
export type {
    RelationshipNode,
    RelationshipEdge,
    RelationshipGraph,
    RelationshipGraphFilters
};
