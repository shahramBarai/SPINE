// --- Service Functions (use CRUD style naming) ---

import z from "zod";
import { fusekiClient } from "../db/client";
import { FusekiSparqlError } from "../db/fuseki";
import { uri_to_id, sparqlStringLiteral } from "../utils";

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

// Shared by get_tree (one named graph, `<uri>`), get_root_id's dataset-wide
// scan (`?g`, optionally narrowed further by extraGraphFilter), and its
// preferred-discipline scan (`?g` + a STRSTARTS filter) - same shape of
// query and tree assembly, differing only in how much of the dataset the
// GRAPH clause covers.
async function queryTreeRoots(
    datasetName: string,
    graphPattern: string,
    extraGraphFilter: string = ""
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
                ${extraGraphFilter}
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
 * Resolves the project's default relationship-graph focus: the id of a root
 * node (a bot:Site/Building/Storey/Space with no parent) in the dataset.
 *
 * Each discipline keeps its own independent copy of the site/building/storey
 * skeleton (different UUIDs per discipline, stitched together by owl:sameAs
 * links in Linkset graphs) - so picking a root from an unbound scan over
 * every graph is arbitrary whenever more than one discipline is synced. To
 * keep the default focus stable, graphs whose URI starts with
 * preferredGraphPrefix (e.g. the architectural discipline's graphs) are
 * tried first; only if none of those have data yet does this fall back to
 * any graph in the dataset.
 *
 * @param datasetName The name of the dataset to query.
 * @param preferredGraphPrefix Prefix (e.g. from buildTtlGraphUri(discipline, "")) identifying the graphs to prefer a root from.
 * @returns The short local id of a root node.
 * @throws FusekiSparqlError (status 404) if the dataset has no synced graph data yet, or if the server returns an error status code or there's a network error.
 */
async function get_root_id(
    datasetName: string,
    preferredGraphPrefix?: string
): Promise<string> {
    if (preferredGraphPrefix) {
        const preferredRoots = await queryTreeRoots(
            datasetName,
            "?g",
            `FILTER(STRSTARTS(STR(?g), ${sparqlStringLiteral(preferredGraphPrefix)}))`
        );
        const preferredRootId = preferredRoots[0]?.id;
        if (preferredRootId) {
            return preferredRootId;
        }
    }

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
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { get_tree, get_root_id };
