import { BACKEND_URL } from "./backendUrl";

const FILES_ROUTE_PREFIX = `${BACKEND_URL}/files/`;

// Builds a downloadable URL for a project file's object key
// (<projectId>/[folder/]<fileId>), matching the backend's plain (non-tRPC)
// /files/* route - each path segment is percent-encoded independently so a
// fileId/folder containing special characters isn't misread as an extra
// path segment.
function buildProjectFileUrl(objectKey: string): string {
    return (
        FILES_ROUTE_PREFIX +
        objectKey.split("/").map(encodeURIComponent).join("/")
    );
}

// Builds the URL to PUT a new file's bytes to - the backend streams the
// request body straight into MinIO and mints the fileId itself, so this
// never points at MinIO directly.
function buildProjectFileUploadUrl(
    projectId: string,
    folder: string,
    fileName: string
): string {
    const path = [projectId, folder].map(encodeURIComponent).join("/");
    const query = new URLSearchParams({ fileName }).toString();
    return `${FILES_ROUTE_PREFIX}${path}?${query}`;
}

// Reserved folder name for cover images - must match ReservedFolder.Cover in
// @spine/storage-minio (a backend-only package, not importable from here).
const COVER_FOLDER = ".cover";

function buildCoverImageUploadUrl(projectId: string, fileName: string): string {
    return buildProjectFileUploadUrl(projectId, COVER_FOLDER, fileName);
}

export {
    buildProjectFileUrl,
    buildProjectFileUploadUrl,
    buildCoverImageUploadUrl
};
