import z from "zod";
import { base64Encode } from "../utils";

/* ------ Schemas ------ */

const DatasetQueryResultSchema = z.object({
    "ds.name": z.string(),
    "ds.state": z.boolean(),
    "ds.services": z
        .array(
            z.object({
                "srv.type": z.string(),
                "srv.description": z.string(),
                "srv.endpoints": z.array(z.string()).default([])
            })
        )
        .default([])
});
type DatasetQueryResult = z.infer<typeof DatasetQueryResultSchema>;

const OperationalEndpointStatsSchema = z.object({
    Requests: z.number().int().nonnegative(),
    RequestsGood: z.number().int().nonnegative(),
    RequestsBad: z.number().int().nonnegative(),
    operation: z.string(),
    description: z.string()
});
const GetOperationalStatsResponseSchema = z.object({
    datasets: z.record(
        z.string(),
        z.object({
            Requests: z.number().int().nonnegative(),
            RequestsGood: z.number().int().nonnegative(),
            RequestsBad: z.number().int().nonnegative(),
            endpoints: z.record(z.string(), OperationalEndpointStatsSchema)
        })
    )
});
type GetOperationalStatsResponse = z.infer<
    typeof GetOperationalStatsResponseSchema
>;

/* ----- Error Handling ----- */

class FusekiSparqlError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "FusekiSparqlError";
        this.status = status;
    }
}

/* ----- Fuseki Client ----- */

class FusekiClient {
    private readonly baseUrl: string;
    private readonly username: string;
    private readonly password: string;
    private readonly timeoutMs: number;

    /**
     * Initializes the Fuseki client.
     *
     * @param baseUrl The root URL of the Fuseki server, such as "http://localhost:3030".
     * @param username The username for authentication.
     * @param password The password for authentication.
     */
    constructor(baseUrl: string, username: string, password: string) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.username = username;
        this.password = password;
        this.timeoutMs = 30_000;
    }

    private getAuthHeader(): string {
        const token = base64Encode(`${this.username}:${this.password}`);
        return `Basic ${token}`;
    }

    private async request(url: string, init: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(url, {
                ...init,
                signal: controller.signal
            });

            return response;
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                throw new FusekiSparqlError("Fuseki request timed out.");
            }

            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async raiseForStatus(response: Response): Promise<void> {
        if (response.ok) {
            return;
        }

        const body = await response.text().catch(() => "");
        throw new FusekiSparqlError(
            `Fuseki request failed with status ${response.status}${body ? `: ${body}` : ""}`,
            response.status
        );
    }

    // --- SPARQL query and update methods ---
    /**
     * Executes a SPARQL query via HTTP POST. Implements the W3C SPARQL 1.1 Protocol.
     *
     * Important: This method is designed for SPARQL SELECT, ASK, CONSTRUCT, and DESCRIBE queries.
     * For change operations (INSERT, DELETE and DROP), see the `update` method.
     *
     * @param dataset_name The name of the dataset to query.
     * @param query The SPARQL query string to execute.
     * @param resultSchema A Zod schema to validate the structure of the query result.
     * @returns The parsed result of the SPARQL query, validated against the provided Zod schema.
     * @throws FusekiSparqlError if the request fails or the server returns an error status.
     */
    async sparql_query<T>(
        dataset_name: string,
        query: string,
        resultSchema: z.ZodType<T>
    ): Promise<T> {
        const endpoint = `/${dataset_name}/query`;
        const headers: HeadersInit = {
            "Content-Type": "application/sparql-query",
            Accept: "application/sparql-results+json",
            Authorization: this.getAuthHeader()
        };

        // Construct the full URL with query parameters
        const url = new URL(`${this.baseUrl}${endpoint}`);
        url.searchParams.set("query", query);

        const response = await this.request(url.toString(), {
            method: "GET",
            headers
        });

        await this.raiseForStatus(response);

        try {
            const data = await response.json();
            const parsedResult = resultSchema.parse(data.results?.bindings);
            return parsedResult;
        } catch (error) {
            console.error("Error parsing SPARQL query result:", error);
            return resultSchema.parse([]); // Return an empty array if parsing fails
        }
    }

    /**
     * Executes a SPARQL Update operation (INSERT, DELETE, DROP) via HTTP POST.
     *
     * @param dataset_name The name of the dataset to update.
     * @param query The SPARQL update string to execute.
     * @throws FusekiSparqlError if the request fails or the server returns an error status.
     */
    async sparql_update(dataset_name: string, query: string): Promise<void> {
        const endpoint = `/${dataset_name}/update`;
        const headers: HeadersInit = {
            "Content-Type": "application/sparql-update",
            Authorization: this.getAuthHeader()
        };

        const response = await this.request(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers,
            body: query
        });

        await this.raiseForStatus(response);
    }

    // --- Graph Store Protocol methods for direct graph manipulation ---
    /**
     * Retrieves the RDF graph in Turtle format using Grapth Store Protocol.
     *
     * @param dataset_name The name of the dataset on the Fuseki server.
     * @param graph_uri The URI of the graph to retrieve. If None, the default graph is returned.
     * @returns The RDF graph in Turtle format as a string.
     * @throws FusekiSparqlError if the request fails or the server returns an error status.
     */
    async graph_get_ttl(
        dataset_name: string,
        graph_uri?: string
    ): Promise<string> {
        const endpoint = `/${dataset_name}/data`;
        const url = new URL(`${this.baseUrl}${endpoint}`);

        if (graph_uri) {
            url.searchParams.set("graph", graph_uri);
        } else {
            url.searchParams.set("default", "");
        }

        const headers: HeadersInit = {
            Accept: "text/turtle; charset=utf-8",
            Authorization: this.getAuthHeader()
        };

        const response = await this.request(url.toString(), {
            method: "GET",
            headers
        });

        await this.raiseForStatus(response);
        return await response.text();
    }

    /**
     * Uploads RDF data in Turtle format to a specified graph. Supports both appending and replacing graph content.
     *
     * @param dataset_name The name of the dataset containing the graph.
     * @param graph_uri The URI of the graph to upload to. If None, the default graph is targeted.
     * @param payload The RDF data in Turtle format as bytes.
     * @param replace If True, replaces the existing graph content. If False, appends to the graph.
     * @throws FusekiSparqlError if the request fails or the server returns an error status.
     */
    async graph_upload_ttl(
        dataset_name: string,
        payload: Uint8Array | ArrayBuffer | string,
        graph_uri?: string,
        replace: boolean = false
    ): Promise<void> {
        const endpoint = `/${dataset_name}/data`;
        const url = new URL(`${this.baseUrl}${endpoint}`);

        if (graph_uri) {
            url.searchParams.set("graph", graph_uri);
        } else {
            url.searchParams.set("default", "");
        }

        const headers: HeadersInit = {
            "Content-Type": "text/turtle",
            Authorization: this.getAuthHeader()
        };

        const response = await this.request(url.toString(), {
            method: replace ? "PUT" : "POST",
            headers,
            body: payload as BodyInit
        });

        await this.raiseForStatus(response);
    }

    // --- Additional utility methods for operational stats and dataset management ---

    /**
     * Creates a new dataset on the Fuseki server. Idempotent: if a dataset with
     * this name already exists, the call succeeds without modifying it.
     *
     * @param dataset_name The name of the dataset to create.
     * @param dbType The backing storage type for the dataset. Defaults to "tdb2" (persistent).
     * @throws FusekiSparqlError if the request fails for a reason other than the dataset already existing.
     */
    async create_dataset(
        dataset_name: string,
        dbType: "tdb2" | "mem" = "tdb2"
    ): Promise<void> {
        const headers: HeadersInit = {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: this.getAuthHeader()
        };

        const body = new URLSearchParams({
            dbName: dataset_name,
            dbType
        });

        const response = await this.request(`${this.baseUrl}/$/datasets`, {
            method: "POST",
            headers,
            body: body.toString()
        });

        // A 409 means the dataset already exists - creation is idempotent.
        if (response.status === 409) {
            return;
        }

        await this.raiseForStatus(response);
    }

    /**
     * Retrieves a list of dataset names available on the Fuseki server.
     *
     * @return A list of dataset information dictionaries.
     * @throws FusekiSparqlError if the request fails or the server returns an error status.
     */
    async get_datasets(): Promise<DatasetQueryResult[]> {
        const headers: HeadersInit = {
            Authorization: this.getAuthHeader()
        };

        const response = await this.request(`${this.baseUrl}/$/datasets`, {
            method: "GET",
            headers
        });

        await this.raiseForStatus(response);

        try {
            const data = await response.json();
            if (!data.datasets || !Array.isArray(data.datasets)) {
                console.warn("Unexpected datasets response format:", data);
                return [];
            }
            return DatasetQueryResultSchema.array().parse(data.datasets);
        } catch (error) {
            console.error("Error parsing datasets info:", error);
            return [];
        }
    }

    /**
     * Retrieves request counters and error metrics for this specific dataset.
     *
     * @param dataset_name The name of the dataset to retrieve stats for.
     * @returns A dictionary containing request counts and error metrics.
     * @throws FusekiSparqlError if the request fails or the server returns an error status.
     */
    async get_operational_stats(
        dataset_name: string
    ): Promise<GetOperationalStatsResponse> {
        const headers: HeadersInit = {};
        const authHeader = this.getAuthHeader();
        if (authHeader) {
            headers.Authorization = authHeader;
        }

        const response = await this.request(
            `${this.baseUrl}/$/stats/${dataset_name}`,
            {
                method: "GET",
                headers
            }
        );

        await this.raiseForStatus(response);
        const data = await response.json();
        return GetOperationalStatsResponseSchema.parse(data);
    }

    /**
     * Checks if the Fuseki server is reachable by sending a simple GET request to the root endpoint.
     *
     * @returns A tuple containing a boolean indicating connectivity and an optional error message if the ping fails.
     */
    async ping(): Promise<[boolean, string | null]> {
        try {
            const headers: HeadersInit = {};
            const authHeader = this.getAuthHeader();
            if (authHeader) {
                headers.Authorization = authHeader;
            }

            const response = await this.request(`${this.baseUrl}/`, {
                method: "GET",
                headers
            });

            return [response.status === 200, null];
        } catch (error) {
            if (error instanceof FusekiSparqlError) {
                return [false, error.message];
            }

            if (error instanceof Error) {
                return [false, error.message];
            }

            return [false, "Unexpected error"];
        }
    }
}

export { FusekiClient, FusekiSparqlError };
