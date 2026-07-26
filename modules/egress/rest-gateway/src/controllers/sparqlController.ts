import { IncomingMessage, ServerResponse } from "http";
import { ApiKeyService } from "@spine/storage-platform";
import { SemanticSearchService } from "@spine/storage-rdf-store";

// TODO: this was lifted as-is from modules/app/backend/src/routes/sparqlApi.ts
// (a plain Node http handler) as a starting point - swap the req/res plumbing
// for whichever API library/framework this service ends up using, but keep
// the auth-then-execute shape: verify the bearer API key against
// ApiKeyService, confirm it belongs to the requested project, then run the
// query via SemanticSearchService.

const ROUTE_PATTERN = /^\/api\/v1\/projects\/([^/]+)\/sparql$/;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(chunk as Buffer);
    }
    const raw = Buffer.concat(chunks).toString("utf-8");
    return raw ? JSON.parse(raw) : {};
}

/**
 * Handles `POST /api/v1/projects/<projectId>/sparql` - lets an external
 * system authenticated with a project API key run a read-only SPARQL
 * SELECT query against that project's dataset. Auth is a bearer API key
 * (see ApiKeyService), not a user session - this is meant for non-browser,
 * server-to-server callers.
 *
 * Returns true if this request was handled (the response has been sent),
 * false if the caller should fall through to the next handler.
 */
async function handleSparqlApiRoute(
    req: IncomingMessage,
    res: ServerResponse
): Promise<boolean> {
    const url = new URL(req.url ?? "", "http://localhost");
    const match = url.pathname.match(ROUTE_PATTERN);
    if (req.method !== "POST" || !match?.[1]) {
        return false;
    }

    const projectId = decodeURIComponent(match[1]);

    const authHeader = req.headers.authorization ?? "";
    const rawKey = authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : "";
    if (!rawKey) {
        sendJson(res, 401, {
            error: "Missing or malformed Authorization header. Expected: Bearer <api-key>."
        });
        return true;
    }

    const verified = await ApiKeyService.verifyApiKey(rawKey);
    if (!verified || verified.entityId !== projectId) {
        sendJson(res, 401, { error: "Invalid API key." });
        return true;
    }

    let body: unknown;
    try {
        body = await readJsonBody(req);
    } catch {
        sendJson(res, 400, { error: "Request body must be valid JSON." });
        return true;
    }

    const query = (body as { query?: unknown } | null)?.query;
    if (typeof query !== "string" || !query.trim()) {
        sendJson(res, 400, {
            error: 'Request body must include a non-empty "query" string.'
        });
        return true;
    }

    try {
        const triples = await SemanticSearchService.executeSemanticSearchQuery(
            projectId,
            query
        );
        sendJson(res, 200, { triples });
    } catch (error) {
        sendJson(res, 400, {
            error:
                error instanceof Error
                    ? error.message
                    : "Failed to execute SPARQL query"
        });
    }

    return true;
}

export { handleSparqlApiRoute };
