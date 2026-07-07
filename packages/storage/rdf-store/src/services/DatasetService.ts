import { z } from "zod";
import { fusekiClient } from "../db/client";

/* ------------------------------------------------------- */
/* ------ Service Functions (use CRUD style naming) ------ */
/* ------------------------------------------------------- */

/**
 * Retrieves a list of graph URIs from the Fuseki dataset.
 *
 * @returns A list of graph URIs available in the dataset.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 * @throws ZodError If the response data does not conform to the expected schema.
 */
async function read_datasets() {
    return await fusekiClient.get_datasets();
}

/**
 * Retrieves a list of graph URIs from the Fuseki dataset.
 *
 * @param datasetName - The name of the dataset to query.
 * @returns A list of graph URIs available in the dataset.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function read_list_graphs(datasetName: string) {
    const queryResultSchema = z.array(
        z.object({
            g: z
                .object({
                    type: z.string(),
                    value: z.string()
                })
                .optional(),
            count: z.object({
                value: z.string()
            })
        })
    );
    const defaultGraphQuery = `SELECT (COUNT(*) AS ?count) {?s ?p ?o}`;
    const namedGraphsQuery = `SELECT ?g (COUNT(*) AS ?count) WHERE { GRAPH ?g { ?s ?p ?o } } GROUP BY ?g`;

    const defaultGraphResult = await fusekiClient.sparql_query(
        datasetName,
        defaultGraphQuery,
        queryResultSchema
    );
    const namedGraphsResult = await fusekiClient.sparql_query(
        datasetName,
        namedGraphsQuery,
        queryResultSchema
    );

    const graphsInfo = [];

    graphsInfo.push({
        uri: "default",
        count: parseInt(defaultGraphResult[0]?.count.value || "0", 10)
    });

    for (const row of namedGraphsResult) {
        graphsInfo.push({
            uri: row.g?.value || "unknown",
            count: parseInt(row.count.value || "0", 10)
        });
    }

    return graphsInfo;
}

/**
 * Uploads TTL content to the specified dataset and graph in Fuseki.
 *
 * @param datasetName - The name of the dataset to upload to.
 * @param ttlContent - The TTL content to upload as bytes.
 * @param graphUri - The URI of the graph to upload to. If omitted, the default graph is targeted.
 * @param replace - If true, replaces the existing graph content instead of appending to it.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function uploadTtlToFuseki(
    datasetName: string,
    ttlContent: Buffer | Uint8Array,
    graphUri?: string,
    replace: boolean = false
): Promise<void> {
    await fusekiClient.graph_upload_ttl(
        datasetName,
        ttlContent,
        graphUri,
        replace
    );
}

/**
 * Deletes a graph from the specified dataset in Fuseki.
 *
 * @param datasetName - The name of the dataset to delete from.
 * @param graphUri - The URI of the graph to delete. If omitted, the default graph is targeted.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function deleteGraph(
    datasetName: string,
    graphUri?: string
): Promise<void> {
    const query = graphUri ? `DROP GRAPH <${graphUri}>` : "DROP DEFAULT";
    await fusekiClient.sparql_update(datasetName, query);
}

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { read_datasets, read_list_graphs, uploadTtlToFuseki, deleteGraph };
