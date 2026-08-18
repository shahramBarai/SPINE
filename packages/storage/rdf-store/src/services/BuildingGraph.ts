// --- Service Functions (use CRUD style naming) ---

import z from "zod";
import { fusekiClient } from "../db/client";
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

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { get_tree };
