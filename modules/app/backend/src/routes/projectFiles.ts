import { IncomingMessage, ServerResponse } from "http";
import { EntityService, FileService } from "@spine/storage-platform";
import { type MemberRole } from "@spine/storage-platform/types";
import { ProjectFileService } from "@spine/storage-minio";
import { serveSecureFile, getMimeType } from "../utils/secureFile";
import { getCoverImageUrl } from "../utils/coverImage";
import { generateFileId } from "../utils/fileId";
import { getServerSession, type UserSession } from "../auth/iron-session";

const { ReservedFolder } = ProjectFileService;
const ROUTE_PREFIX = "/files/";
const EDITOR_ROLES: MemberRole[] = ["OWNER", "EDITOR"];
const OWNER_ROLES: MemberRole[] = ["OWNER"];

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, message: string): void {
    res.writeHead(status, { "Content-Type": "text/plain" });
    res.end(message);
}

// Checks the caller's session and project role, writing a 401/403 directly
// if either fails - the one gate a project file upload (through the
// backend, never straight to MinIO) has to pass.
async function requireProjectRole(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    allowedRoles: MemberRole[]
): Promise<UserSession | null> {
    const session = await getServerSession(req, res);
    const user = session.data?.user;
    if (!user) {
        sendText(res, 401, "Unauthorized");
        return null;
    }

    const member = await EntityService.getMember(projectId, user.id);
    if (!member || !allowedRoles.includes(member.role)) {
        sendText(res, 403, "Forbidden");
        return null;
    }

    return user;
}

/**
 * Handles `PUT /files/<projectId>/<folder>?fileName=<name>` - streams the
 * request body straight into MinIO (no buffering the whole file in memory)
 * and registers the result, in one round trip:
 *  - a regular folder registers a `File` row (FilesOverviewTab uploads);
 *  - the reserved cover folder instead points the project's coverImageKey
 *    at the new object and cleans up the previous one.
 */
async function handleProjectFileUpload(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    folder: string,
    fileName: string
): Promise<void> {
    const isCover = folder === ReservedFolder.Cover;
    const user = await requireProjectRole(
        req,
        res,
        projectId,
        isCover ? OWNER_ROLES : EDITOR_ROLES
    );
    if (!user) return;

    const fileId = generateFileId(fileName);
    const contentLength = req.headers["content-length"];
    const size = contentLength ? Number(contentLength) : undefined;

    let objectKey: string;
    try {
        objectKey = await ProjectFileService.saveFile(
            projectId,
            fileId,
            req,
            isCover
                ? ProjectFileService.ALLOWED_EXTENSIONS.image
                : ProjectFileService.ALLOWED_EXTENSIONS.file,
            folder,
            size
        );
    } catch (error) {
        sendText(
            res,
            400,
            error instanceof Error ? error.message : "Invalid file"
        );
        return;
    }

    // Never trust the client-supplied Content-Length for what gets stored.
    const stat = await ProjectFileService.statFile(objectKey);
    if (!stat) {
        sendText(
            res,
            500,
            "Upload did not complete - the file wasn't found in storage."
        );
        return;
    }

    if (isCover) {
        const project = await EntityService.getEntityById(projectId);
        const previousKey = project?.coverImageKey;

        await EntityService.updateEntity(projectId, {
            coverImageKey: objectKey
        });

        if (previousKey && previousKey !== objectKey) {
            try {
                await ProjectFileService.deleteFile(previousKey);
            } catch (error) {
                console.error(
                    `Failed to delete previous cover image ${previousKey}:`,
                    error
                );
            }
        }

        sendJson(res, 200, { coverImageUrl: getCoverImageUrl(objectKey) });
        return;
    }

    const file = await FileService.createFile({
        id: fileId,
        entityId: projectId,
        fileName,
        size: stat.size,
        mimeType: getMimeType(fileName),
        objectKey,
        createdBy: user.id
    });

    sendJson(res, 200, file);
}

/**
 * Handles `GET /files/<projectId>/<folder>/<fileId>` - cover images (stored
 * under the reserved ReservedFolder.Cover, not Postgres-tracked) are served
 * straight from the object key; every other project file is Postgres-tracked
 * and looks up its fileName/objectKey from its File row.
 *
 * Cover images are viewable by anyone who can see the project at all -
 * public, or a member. Every other project file requires membership,
 * matching the project-role hierarchy the Files tab already enforces for
 * listing/uploading.
 */
async function handleProjectFileDownload(
    req: IncomingMessage,
    res: ServerResponse,
    projectId: string,
    folder: string,
    fileId: string
): Promise<void> {
    const objectKey = ProjectFileService.buildObjectKey(
        projectId,
        fileId,
        folder
    );

    if (folder === ReservedFolder.Cover) {
        await serveSecureFile({
            req,
            res,
            fileName: fileId,
            disposition: "inline",
            getStream: () => ProjectFileService.readFile(objectKey),
            authorize: async (user) => {
                const project = await EntityService.getEntityById(projectId);
                if (!project) return false;
                if (project.isPublic) return true;
                return Boolean(
                    user && (await EntityService.getMember(projectId, user.id))
                );
            }
        });
        return;
    }

    const file = await FileService.getFile(projectId, fileId);
    if (!file) {
        sendText(res, 404, "Not found");
        return;
    }

    await serveSecureFile({
        req,
        res,
        fileName: file.fileName,
        disposition: "attachment",
        contentLength: file.size,
        getStream: () => ProjectFileService.readFile(file.objectKey),
        authorize: async (user) =>
            Boolean(user && (await EntityService.getMember(projectId, user.id)))
    });
}

/**
 * Returns true if this request was handled (the response has been sent),
 * false if the caller should fall through to the next handler (tRPC).
 */
async function handleProjectFilesRoute(
    req: IncomingMessage,
    res: ServerResponse
): Promise<boolean> {
    const url = new URL(req.url ?? "", "http://localhost");
    if (!url.pathname.startsWith(ROUTE_PREFIX)) {
        return false;
    }
    if (req.method !== "GET" && req.method !== "PUT") {
        return false;
    }

    const segments = url.pathname
        .slice(ROUTE_PREFIX.length)
        .split("/")
        .map(decodeURIComponent);

    if (req.method === "PUT") {
        const [projectId, folder] = segments;
        const fileName = url.searchParams.get("fileName");
        if (!projectId || !folder || !fileName) {
            sendText(res, 400, "Missing projectId, folder, or fileName");
            return true;
        }

        await handleProjectFileUpload(req, res, projectId, folder, fileName);
        return true;
    }

    const [projectId, folder, fileId] = segments;
    if (!projectId || !folder || !fileId) {
        sendText(res, 404, "Not found");
        return true;
    }

    await handleProjectFileDownload(req, res, projectId, folder, fileId);
    return true;
}

export { handleProjectFilesRoute };
