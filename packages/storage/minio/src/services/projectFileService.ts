import { type BUCKET_NAMES } from "../db/minio";
import * as BucketService from "./primitives/bucketService";
import * as PresignedService from "./primitives/presignedService";

/* -------------------------------- INTERFACES -------------------------------- */

interface UploadUrlResult {
    uploadUrl: string;
    objectKey: string;
}

/* -------------------------------- CONSTANTS -------------------------------- */

const PROJECT_FILES_BUCKET: BUCKET_NAMES = "project-files";

enum ReservedFolder {
    Cover = ".cover",
    SavedQueries = "queries"
}

const ALLOWED_EXTENSIONS = {
    file: ["ifc", "ttl", "pdf", "rq"],
    image: ["png", "jpg", "jpeg", "webp", "gif"]
} as const;

/* -------------------------------- HELPERS -------------------------------- */

// Every stored file's key is <projectId>/[folder/]<fileId> - fileId is an
// opaque last path segment, sometimes a random UUID (project files, cover
// images), sometimes a human-chosen name (saved queries, keyed by query
// name + ".rq" - see buildSavedQueryFileName). Omitting folder puts a file
// at the project's root.
function buildObjectKey(
    projectId: string,
    fileId: string,
    folder?: string
): string {
    return folder
        ? `${projectId}/${folder}/${fileId}`
        : `${projectId}/${fileId}`;
}

// There's no folder column on File, so anything needing "which folder is
// this file in" reads it back out of the one place it's actually stored.
// Undefined means root.
function getFolderFromObjectKey(objectKey: string): string | undefined {
    const parts = objectKey.split("/");
    return parts.length > 2 ? parts[1] : undefined;
}

// Saved queries are stored as plain .rq files, keyed by name rather than a
// random id - these two are the single source of truth for that naming
// convention, so callers work with query names and never build/parse the
// fileId themselves.
function buildSavedQueryFileName(name: string): string {
    return `${name}.rq`;
}

function parseSavedQueryName(fileId: string): string {
    return fileId.replace(/\.rq$/i, "");
}

function assertAllowedExtension(
    fileName: string,
    allowedExtensions: readonly string[],
    label: string
): void {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
        throw new Error(
            `Invalid ${label} type. Only ${allowedExtensions.join(", ")} files are allowed.`
        );
    }
}

// A "/" inside folder would inject extra path segments, which
// getFolderFromObjectKey's positional parsing can't tell apart from a real
// subfolder.
function assertNoPathSeparator(value: string, label: string): void {
    if (value.includes("/")) {
        throw new Error(`${label} cannot contain "/".`);
    }
}

/* -------------------------------- CREATE -------------------------------- */

/**
 * Generates a presigned upload URL for a new file, after checking its
 * extension against `allowedExtensions`.
 * @throws {Error} If the file's extension isn't in `allowedExtensions`
 */
async function createUploadUrl(
    projectId: string,
    fileName: string,
    allowedExtensions: readonly string[],
    folder?: string
): Promise<UploadUrlResult> {
    if (folder) assertNoPathSeparator(folder, "Folder name");
    assertAllowedExtension(fileName, allowedExtensions, "file");

    const objectKey = buildObjectKey(projectId, fileName, folder);
    const uploadUrl = await PresignedService.generatePresignedUploadUrl({
        bucketName: PROJECT_FILES_BUCKET,
        objectName: objectKey,
        expiry: 120
    });

    return { uploadUrl, objectKey };
}

/**
 * Saves a buffer as a new file, after checking its extension against
 * `allowedExtensions` - a server-side counterpart to createUploadUrl for
 * when the caller already has the bytes in hand (e.g. a tool's output, or a
 * saved SPARQL query), so no presigned-URL round trip is needed.
 * @throws {Error} If the file's extension isn't in `allowedExtensions`
 */
async function saveFile(
    projectId: string,
    fileName: string,
    content: Buffer,
    allowedExtensions: readonly string[],
    folder?: string
): Promise<string> {
    if (folder) assertNoPathSeparator(folder, "Folder name");
    assertAllowedExtension(fileName, allowedExtensions, "file");

    const objectKey = buildObjectKey(projectId, fileName, folder);
    await BucketService.uploadBuffer(PROJECT_FILES_BUCKET, objectKey, content);

    return objectKey;
}

/* -------------------------------- READ -------------------------------- */

/**
 * Reads a file's contents by its object key, or `null` if it doesn't exist.
 */
async function readFile(objectKey: string) {
    return await BucketService.readFile(PROJECT_FILES_BUCKET, objectKey);
}

/**
 * Checks that a presigned-upload actually completed, returning the object's
 * real size/lastModified (never trust a client-supplied size) - or `null`
 * if nothing was ever uploaded to that key. Used by confirmUpload so a
 * File row is only ever created for an upload that genuinely happened.
 */
async function statFile(objectKey: string) {
    return await BucketService.statFile(PROJECT_FILES_BUCKET, objectKey);
}

/* -------------------------------- DELETE -------------------------------- */

async function deleteFile(objectKey: string): Promise<void> {
    await BucketService.deleteFile(PROJECT_FILES_BUCKET, objectKey);
}

export {
    ReservedFolder,
    ALLOWED_EXTENSIONS,
    buildObjectKey,
    getFolderFromObjectKey,
    buildSavedQueryFileName,
    parseSavedQueryName,
    createUploadUrl,
    saveFile,
    readFile,
    statFile,
    deleteFile
};
