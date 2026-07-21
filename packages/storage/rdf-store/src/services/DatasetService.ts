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
 * Creates a new dataset on the Fuseki server. Idempotent: succeeds without
 * changes if a dataset with this name already exists.
 *
 * @param datasetName - The name of the dataset to create.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function createDataset(datasetName: string): Promise<void> {
    await fusekiClient.create_dataset(datasetName);
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

// Graph URIs are interpolated directly into SPARQL query/update text below
// (Graph Store Protocol calls like uploadTtlToFuseki instead pass graphUri
// through URLSearchParams, which escapes it safely). Rejecting characters
// that could break out of a SPARQL IRI reference (<...>) or inject
// additional update statements closes that off.
function assertValidGraphUri(graphUri: string): void {
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>"{}|\\^`]+$/.test(graphUri)) {
        throw new Error(`Invalid graph URI: ${graphUri}`);
    }
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
    if (graphUri) {
        assertValidGraphUri(graphUri);
    }

    const query = graphUri ? `DROP GRAPH <${graphUri}>` : "DROP DEFAULT";
    await fusekiClient.sparql_update(datasetName, query);
}

/**
 * Creates a new, empty named graph. Fuseki/SPARQL has no concept of a named
 * graph with zero triples - read_list_graphs only finds graphs by matching
 * triples inside them - so this inserts a small marker triple recording when
 * the graph was created, mirroring the same "empty folder needs a
 * placeholder object" pattern used for MinIO folders.
 *
 * @param datasetName - The name of the dataset to create the graph in.
 * @param graphUri - The URI of the new graph.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function createGraph(
    datasetName: string,
    graphUri: string
): Promise<void> {
    assertValidGraphUri(graphUri);

    const timestamp = new Date().toISOString();
    const query = `INSERT DATA { GRAPH <${graphUri}> { <${graphUri}> <http://purl.org/dc/terms/created> "${timestamp}"^^<http://www.w3.org/2001/XMLSchema#dateTime> } }`;
    await fusekiClient.sparql_update(datasetName, query);
}

/**
 * Renames a graph by moving all of its triples into a new graph URI and
 * dropping the old one (SPARQL 1.1 Update's MOVE is exactly this operation).
 *
 * @param datasetName - The name of the dataset containing the graph.
 * @param oldUri - The graph's current URI.
 * @param newUri - The graph's new URI.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 */
async function renameGraph(
    datasetName: string,
    oldUri: string,
    newUri: string
): Promise<void> {
    assertValidGraphUri(newUri);

    const query = `MOVE GRAPH <${oldUri}> TO <${newUri}>`;
    await fusekiClient.sparql_update(datasetName, query);
}

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export {
    read_datasets,
    createDataset,
    read_list_graphs,
    uploadTtlToFuseki,
    deleteGraph,
    createGraph,
    renameGraph
};
