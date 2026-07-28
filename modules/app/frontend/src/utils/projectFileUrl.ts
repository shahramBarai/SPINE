import { BACKEND_URL } from "utils/backendUrl";

// Builds a URL for the secure /files proxy (see backend routes/projectFiles.ts),
// which re-checks project membership on every request rather than handing out
// a standing bearer link like a presigned MinIO URL would - safe to use for
// both a plain download link and a fetch() that needs the raw bytes (e.g. to
// parse an IFC file client-side).
function buildProjectFileUrl(
    projectId: string,
    folder: string,
    fileId: string,
    fileName: string
): string {
    const objectKey = [projectId, folder, `${fileId}_${fileName}`]
        .map(encodeURIComponent)
        .join("/");
    return `${BACKEND_URL}/files/${objectKey}`;
}

export { buildProjectFileUrl };
