import { IncomingMessage, ServerResponse } from "http";
import { EntityService } from "@spine/storage-platform";
import { type BUCKET_NAMES } from "@spine/storage-minio";
import { serveSecureFile } from "../utils/secureFile";
import { COVER_IMAGE_FOLDER } from "../utils/coverImage";

const BUCKET_NAME: BUCKET_NAMES = "project-files";
const ROUTE_PREFIX = "/files/";

/**
 * Handles `GET /files/<projectId>/<...objectKeyParts>` - the URL path is
 * exactly the object's key within the project-files bucket, so serving a
 * file is just an authorization check followed by a stream.
 *
 * Cover images (stored under the reserved COVER_IMAGE_FOLDER) are viewable
 * by anyone who can see the project at all - public, or a member. Every
 * other project file requires membership, matching the project-role
 * hierarchy the Files tab already enforces for listing/uploading.
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
    const [projectId, folder, fullName] = objectKey.split("/");

    if (!projectId || !folder || !fullName) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return true;
    }

    const isCover = folder === COVER_IMAGE_FOLDER;
    const separatorIndex = fullName.indexOf("_");
    const fileName =
        separatorIndex >= 0 ? fullName.slice(separatorIndex + 1) : fullName;

    await serveSecureFile({
        req,
        res,
        bucketName: BUCKET_NAME,
        objectKey,
        fileName,
        disposition: isCover ? "inline" : "attachment",
        authorize: async (user) => {
            if (isCover) {
                const project = await EntityService.getEntityById(projectId);
                if (!project) return false;
                if (project.isPublic) return true;
                return Boolean(
                    user && (await EntityService.getMember(projectId, user.id))
                );
            }

            return Boolean(
                user && (await EntityService.getMember(projectId, user.id))
            );
        }
    });

    return true;
}

export { handleProjectFilesRoute };
