// --- Service Functions (use CRUD style naming) ---

import z from "zod";
import { fusekiClient } from "../db/client";
import { uri_to_id, graphValuesClause } from "../utils";

const sameAsPairQueryResultSchema = z.array(
    z.object({
        a: z.object({ type: z.string(), value: z.string() }),
        b: z.object({ type: z.string(), value: z.string() })
    })
);

/**
 * Finds direct owl:sameAs links (either direction) among the given node
 * URIs, searched across every given graph.
 *
 * @param datasetName The name of the dataset to query.
 * @param graphUris The named graphs to search.
 * @param nodeUris The node URIs to find sameAs links between.
 * @returns Every {a, b} pair found (full URIs, as returned by Fuseki).
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function findSameAsPairs(
    datasetName: string,
    graphUris: string[],
    nodeUris: string[]
): Promise<{ a: string; b: string }[]> {
    if (nodeUris.length === 0) {
        return [];
    }

    const query = `
        PREFIX owl: <http://www.w3.org/2002/07/owl#>

        SELECT ?a ?b WHERE {
            VALUES ?a { ${nodeUris.map((uri) => `<${uri}>`).join(" ")} }
            ${graphValuesClause(graphUris, "sameG")}
            GRAPH ?sameG { ?a (owl:sameAs|^owl:sameAs) ?b }
        }
    `;

    const rows = await fusekiClient.sparql_query(
        datasetName,
        query,
        sameAsPairQueryResultSchema
    );

    return rows.map((row) => ({ a: row.a.value, b: row.b.value }));
}

/**
 * Groups short ids into owl:sameAs-equivalence clusters (transitive, via
 * union-find).
 *
 * @param ids The short local ids to cluster (only pairs where both sides are in this list are considered).
 * @param pairs Direct sameAs links (full URIs, as returned by findSameAsPairs) to cluster by.
 * @returns For each id, every OTHER id in its cluster (empty when nothing else was equivalent to it).
 */
function clusterSameAsIds(
    ids: string[],
    pairs: { a: string; b: string }[]
): Map<string, string[]> {
    const knownIds = new Set(ids);
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
        if (!knownIds.has(a) || !knownIds.has(b)) {
            return;
        }
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB) {
            return;
        }
        if (rootA < rootB) {
            parent.set(rootB, rootA);
        } else {
            parent.set(rootA, rootB);
        }
    };

    for (const pair of pairs) {
        union(uri_to_id(pair.a), uri_to_id(pair.b));
    }

    const clusters = new Map<string, string[]>();
    for (const id of ids) {
        const root = find(id);
        const members = clusters.get(root) ?? [];
        members.push(id);
        clusters.set(root, members);
    }

    const sameAsIdsById = new Map<string, string[]>();
    for (const members of clusters.values()) {
        for (const id of members) {
            sameAsIdsById.set(
                id,
                members.filter((memberId) => memberId !== id)
            );
        }
    }
    return sameAsIdsById;
}

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { findSameAsPairs, clusterSameAsIds };
