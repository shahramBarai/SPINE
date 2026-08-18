import { IncomingMessage, ServerResponse } from "http";
import { type Readable } from "stream";
import { getServerSession, type UserSession } from "../auth/iron-session";

const MIME_TYPES: Record<string, string> = {
    ifc: "application/octet-stream",
    ttl: "text/turtle",
    pdf: "application/pdf",
    rq: "application/sparql-query",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif"
};

function getMimeType(fileName: string): string {
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    return MIME_TYPES[extension] ?? "application/octet-stream";
}

interface ServeSecureFileOptions {
    req: IncomingMessage;
    res: ServerResponse;
    fileName: string;
    disposition?: "inline" | "attachment";
    contentLength?: number;
    authorize: (user: UserSession | undefined) => Promise<boolean> | boolean;
    getStream: () => Promise<Readable | null>;
}

/**
 * Streams a file to an HTTP response, but only after `authorize` approves
 * the caller's session. This is the one place file bytes cross into the
 * browser, so every download/preview route - cover images today, project
 * files (IFC/TTL/PDF) and any future resource type - shares this same
 * auth-then-stream path instead of each handing out a bearer presigned URL
 * of its own.
 */
async function serveSecureFile({
    req,
    res,
    fileName,
    disposition = "attachment",
    contentLength,
    authorize,
    getStream
}: ServeSecureFileOptions): Promise<void> {
    const session = await getServerSession(req, res);
    const authorized = await authorize(session.data?.user);

    if (!authorized) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
    }

    const stream = await getStream();
    if (!stream) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
    }

    res.writeHead(200, {
        "Content-Type": getMimeType(fileName),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Cross-Origin-Resource-Policy": "cross-origin",
        ...(contentLength !== undefined && {
            "Content-Length": String(contentLength)
        })
    });
    stream.pipe(res);
}

export { serveSecureFile, getMimeType };
