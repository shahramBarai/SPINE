import { IncomingMessage, ServerResponse } from "http";
import { EntityService, FileService } from "@spine/storage-platform";
import { ProjectFileService } from "@spine/storage-minio";
import { serveSecureFile } from "../utils/secureFile";

const { ReservedFolder } = ProjectFileService;
const ROUTE_PREFIX = "/files/";

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
 *
 * Returns true if this request was handled (the response has been sent),
 * false if the caller should fall through to the next handler (tRPC).
 */
async function handleProjectFilesRoute(
    req: IncomingMessage,
    res: ServerResponse
): Promise<boolean> {
    const url = new URL(req.url ?? "", "http://localhost");
    if (req.method !== "GET" || !url.pathname.startsWith(ROUTE_PREFIX)) {
        return false;
    }

    const objectKey = decodeURIComponent(
        url.pathname.slice(ROUTE_PREFIX.length)
    );
    const [projectId, folder, fileId] = objectKey.split("/");

    if (!projectId || !folder || !fileId) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return true;
    }

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
        return true;
    }

    const file = await FileService.getFile(projectId, fileId);
    if (!file) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return true;
    }

    await serveSecureFile({
        req,
        res,
        fileName: file.fileName,
        disposition: "attachment",
        getStream: () => ProjectFileService.readFile(file.objectKey),
        authorize: async (user) =>
            Boolean(user && (await EntityService.getMember(projectId, user.id)))
    });

    return true;
}

export { handleProjectFilesRoute };
