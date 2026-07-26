// --- Service Functions (use CRUD style naming) ---

import { z } from "zod";
import { fusekiClient } from "../db/client";

interface Triple {
    subject: string;
    predicate: string;
    object: string;
}

// SPARQL JSON results bind each variable to { type, value, ... } - variable
// names are arbitrary (the query is user-authored), so this only pins down
// the shape of a binding's value, not which variables exist.
const sparqlBindingValueSchema = z.object({ value: z.string() }).passthrough();
const sparqlBindingSchema = z.record(z.string(), sparqlBindingValueSchema);
const sparqlSelectResultSchema = z.array(sparqlBindingSchema);

const MAX_SEMANTIC_SEARCH_TRIPLES = 300;

// Mirrors building-service's sparql_helpers.extract_triple: a binding only
// becomes a displayable triple if it names its three terms either s/p/o or
// subject/predicate/object - anything else (e.g. a query that only selects
// two columns) is silently skipped rather than guessed at.
function extractTriple(
    binding: z.infer<typeof sparqlBindingSchema>
): Triple | null {
    for (const [s, p, o] of [
        ["s", "p", "o"],
        ["subject", "predicate", "object"]
    ] as const) {
        const subject = binding[s]?.value;
        const predicate = binding[p]?.value;
        const object = binding[o]?.value;
        if (subject && predicate && object) {
            return { subject, predicate, object };
        }
    }
    return null;
}

/**
 * Executes a user-authored SPARQL SELECT query against a dataset and
 * extracts displayable triples from its bindings. Only SELECT is
 * supported: the semantic search UI displays subject/predicate/object rows,
 * which is what SELECT's variable bindings map onto - CONSTRUCT/ASK/DESCRIBE
 * return different shapes entirely.
 *
 * Bindings that don't name an s/p/o (or subject/predicate/object) triple are
 * skipped rather than erroring, so a query that legitimately returns zero
 * (or partially-shaped) rows just yields an empty/shorter result instead of
 * failing outright.
 *
 * @param datasetName - The name of the dataset to query.
 * @param query - The user-authored SPARQL query text.
 * @throws {Error} If the query is empty or isn't a SELECT query.
 * @throws FusekiSparqlError If the server returns an error status code or there's a network error.
 * @throws ZodError If the response data does not conform to the expected schema.
 */
async function executeSemanticSearchQuery(
    datasetName: string,
    query: string
): Promise<Triple[]> {
    const trimmed = query.trim();
    if (!trimmed) {
        throw new Error("SPARQL query is required.");
    }
    if (!/\bselect\b/i.test(trimmed)) {
        throw new Error(
            "Only SPARQL SELECT queries are supported for semantic search."
        );
    }

    const bindings = await fusekiClient.sparql_query(
        datasetName,
        trimmed,
        sparqlSelectResultSchema
    );

    const triples: Triple[] = [];
    for (const binding of bindings) {
        const triple = extractTriple(binding);
        if (triple) {
            triples.push(triple);
        }
        if (triples.length >= MAX_SEMANTIC_SEARCH_TRIPLES) {
            break;
        }
    }

    return triples;
}

/* ------------------------------------------------------- */
/* ---- Export the service functions for external use ---- */
/* ------------------------------------------------------- */
export { executeSemanticSearchQuery, type Triple };
