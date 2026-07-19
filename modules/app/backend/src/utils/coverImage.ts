import { type BUCKET_NAMES } from "@spine/storage-minio";
import { env } from "@spine/shared";

const COVER_IMAGE_BUCKET: BUCKET_NAMES = "project-files";

// Cover images live under a reserved ".cover" folder inside the project's
// own key prefix, alongside its regular files. The leading dot marks it as
// internal so listFiles (the Files tab) can filter it out.
const COVER_IMAGE_FOLDER = ".cover";

function buildCoverObjectName(
    projectId: string,
    fileId: string,
    fileName: string
): string {
    return `${projectId}/${COVER_IMAGE_FOLDER}/${fileId}_${fileName}`;
}

// Cover images are served through the /files proxy (see routes/projectFiles.ts)
// rather than a presigned MinIO URL, so viewing one always re-checks the
// project's current visibility/membership instead of handing out a bearer
// link that keeps working after access is revoked.
function getCoverImageUrl(
    coverImageKey: string | null | undefined
): string | null {
    if (!coverImageKey) {
        return null;
    }

    return `${env.BACKEND_URL}/files/${coverImageKey}`;
}

export {
    COVER_IMAGE_BUCKET,
    COVER_IMAGE_FOLDER,
    buildCoverObjectName,
    getCoverImageUrl
};
