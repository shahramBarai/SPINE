import { IncomingMessage, ServerResponse } from "http";

const ROUTE_PATH = "/health";

/**
 * Liveness probe for Docker/uptime checks. A plain route rather than a
 * procedure so it can be hit without a tRPC client, and deliberately
 * dependency-free: it answers "is this process serving HTTP", not "can it
 * reach Postgres/MinIO/Fuseki". The webapp's version claimed
 * `database: "connected"` without ever checking - don't reintroduce that.
 */
async function handleHealthRoute(
    req: IncomingMessage,
    res: ServerResponse
): Promise<boolean> {
    const url = new URL(req.url ?? "", "http://localhost");

    if (url.pathname !== ROUTE_PATH) {
        return false;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
        return false;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
        JSON.stringify({
            status: "ok",
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString()
        })
    );

    return true;
}

export { handleHealthRoute };
