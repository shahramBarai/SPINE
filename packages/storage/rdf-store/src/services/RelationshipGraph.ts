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
    includePredicates?: string[];
};

function includeListLiteral(values: string[]): string {
    return values.map(sparqlStringLiteral).join(", ");
}

// Restricts ?g to exactly the given named graphs, so `GRAPH ?g { ... }`
// below behaves like a UNION across them - this is what lets a link stored
// in one file's graph (e.g. the "Linkset" discipline) connect nodes that
// live in other visible files' graphs.
function graphValuesClause(graphUris: string[]): string {
    const uris = graphUris.map((uri) => `<${uri}>`).join(" ");
    return `VALUES ?g { ${uris} }`;
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
// against the end of a node's URI, scoped to the given graphs being queried
// (kept cheap by staying within them rather than scanning the whole dataset).
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
 * Retrieves the focus node plus its direct neighbors (one hop out), searched
 * across every graph passed in - deliberately simple, mirroring get_tree's
 * shape of "one query, then a small pass in JS", rather than a multi-hop
 * traversal. Passing every currently-visible TTL file's graph is what lets a
 * link stored in one file (e.g. the "Linkset" discipline) connect nodes that
 * live in other files.
 *
 * @param datasetName The name of the dataset to query.
 * @param graphUris The named graphs to search.
 * @param focusId The node to center the graph on - its short local id (matching get_tree/focusObjectId).
 * @param filters Optional include-only allow-lists (by short local name) for neighbor node types and/or the predicates connecting them. The focus node itself is never filtered out.
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

    const query = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

        SELECT ?node ?label ?type ?predicate ?direction WHERE {
            ${graphValuesClause(graphUris)}
            GRAPH ?g {
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
export { get_relationship_graph };
export type {
    RelationshipNode,
    RelationshipEdge,
    RelationshipGraph,
    RelationshipGraphFilters
};
