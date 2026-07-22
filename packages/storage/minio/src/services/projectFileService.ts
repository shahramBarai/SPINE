import { type BUCKET_NAMES } from "../db/minio";
import * as BucketService from "./primitives/bucketService";
import * as PresignedService from "./primitives/presignedService";

/* -------------------------------- INTERFACES -------------------------------- */

interface ProjectFileInfo {
    fileId: string;
    fileName: string;
    size: number;
    lastModified?: Date;
}

interface ProjectFolder {
    folder: string;
    files: ProjectFileInfo[];
    totalSize: number;
    /** The most recent of its files' lastModified, or undefined for an empty folder. */
    lastModified?: Date;
}

interface UploadUrlResult {
    uploadUrl: string;
    objectName: string;
    fileId: string;
}

/* -------------------------------- CONSTANTS -------------------------------- */

const PROJECT_FILES_BUCKET: BUCKET_NAMES = "project-files";

// Empty-object marker that lets a folder exist (and be listed) before any
// real file has been uploaded into it.
const FOLDER_MARKER = ".folder";

// Cover images live under this reserved folder inside a project's own key
// prefix. The leading dot marks it as internal so listProjectFiles - the
// Files tab's listing - filters it out.
const COVER_IMAGE_FOLDER = ".cover";

const ALLOWED_FILE_EXTENSIONS = ["ifc", "ttl", "pdf"] as const;
const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

/* -------------------------------- HELPERS -------------------------------- */

function buildObjectName(
    projectId: string,
    folder: string,
    fileId: string,
    fileName: string
): string {
    return `${projectId}/${folder}/${fileId}_${fileName}`;
}

function buildCoverObjectName(
    projectId: string,
    fileId: string,
    fileName: string
): string {
    return buildObjectName(projectId, COVER_IMAGE_FOLDER, fileId, fileName);
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

// buildObjectName joins projectId/folder/fileId_fileName with "/" to form
// the object key - a "/" inside folder or fileName would inject extra path
// segments, which listProjectFiles' naive parts[1]-as-folder parsing can't
// tell apart from a real subfolder, silently misgrouping files.
function assertNoPathSeparator(value: string, label: string): void {
    if (value.includes("/")) {
        throw new Error(`${label} cannot contain "/".`);
    }
}

/* -------------------------------- CREATE -------------------------------- */

/**
 * Creates a folder for a project by writing an empty marker object, so the
 * folder is listable (via listProjectFiles) before any real file exists in it.
 */
async function createProjectFolder(
    projectId: string,
    folder: string
): Promise<void> {
    assertNoPathSeparator(folder, "Folder name");

    const objectName = `${projectId}/${folder}/${FOLDER_MARKER}`;
    await BucketService.uploadBuffer(
        PROJECT_FILES_BUCKET,
        objectName,
        Buffer.alloc(0)
    );
}

/**
 * Generates a presigned upload URL for a new file in one of a project's
 * folders, after checking its extension against the allowed project file
 * types (IFC/TTL/PDF).
 * @throws {Error} If the file's extension isn't an allowed project file type
 */
async function getProjectFileUploadUrl(
    projectId: string,
    folder: string,
    fileName: string
): Promise<UploadUrlResult> {
    assertNoPathSeparator(folder, "Folder name");
    assertNoPathSeparator(fileName, "File name");
    assertAllowedExtension(fileName, ALLOWED_FILE_EXTENSIONS, "file");

    const fileId = crypto.randomUUID();
    const objectName = buildObjectName(projectId, folder, fileId, fileName);
    const uploadUrl = await PresignedService.generatePresignedUploadUrl({
        bucketName: PROJECT_FILES_BUCKET,
        objectName,
        expiry: 120
    });

    return { uploadUrl, objectName, fileId };
}

/**
 * Saves a buffer as a new file in one of a project's folders - a
 * server-side counterpart to getProjectFileUploadUrl for when the caller
 * already has the bytes in hand (e.g. a tool's output downloaded from
 * another service), so no presigned-URL round trip is needed.
 * @throws {Error} If the file's extension isn't an allowed project file type
 */
async function saveProjectFileBuffer(
    projectId: string,
    folder: string,
    fileName: string,
    content: Buffer
): Promise<{ fileId: string; fileName: string }> {
    assertNoPathSeparator(folder, "Folder name");
    assertNoPathSeparator(fileName, "File name");
    assertAllowedExtension(fileName, ALLOWED_FILE_EXTENSIONS, "file");

    const fileId = crypto.randomUUID();
    const objectName = buildObjectName(projectId, folder, fileId, fileName);
    await BucketService.uploadBuffer(PROJECT_FILES_BUCKET, objectName, content);

    return { fileId, fileName };
}

/**
 * Generates a presigned upload URL for a project's cover image, after
 * checking its extension against the allowed image types.
 * @throws {Error} If the file's extension isn't an allowed image type
 */
async function getCoverImageUploadUrl(
    projectId: string,
    fileName: string
): Promise<UploadUrlResult & { objectKey: string }> {
    assertNoPathSeparator(fileName, "File name");
    assertAllowedExtension(fileName, ALLOWED_IMAGE_EXTENSIONS, "image");

    const fileId = crypto.randomUUID();
    const objectKey = buildCoverObjectName(projectId, fileId, fileName);
    const uploadUrl = await PresignedService.generatePresignedUploadUrl({
        bucketName: PROJECT_FILES_BUCKET,
        objectName: objectKey,
        expiry: 120
    });

    return { uploadUrl, objectName: objectKey, objectKey, fileId };
}

/* -------------------------------- READ -------------------------------- */

/**
 * Lists a project's files grouped by folder. Folders with no real files yet
 * (only a FOLDER_MARKER) are still included, empty. The reserved cover-image
 * folder is never included.
 */
async function listProjectFiles(projectId: string): Promise<ProjectFolder[]> {
    const objects = await BucketService.listFiles({
        bucketName: PROJECT_FILES_BUCKET,
        prefix: `${projectId}/`,
        recursive: true
    });

    const filesByFolder = new Map<string, ProjectFileInfo[]>();

    for (const object of objects) {
        const parts = object.name?.split("/") ?? [];
        const folder = parts[1];
        const fullName = parts[parts.length - 1];
        if (!folder || !fullName || folder === COVER_IMAGE_FOLDER) {
            continue;
        }

        if (!filesByFolder.has(folder)) {
            filesByFolder.set(folder, []);
        }
        if (fullName === FOLDER_MARKER) {
            continue;
        }

        const separatorIndex = fullName.indexOf("_");
        const fileId =
            separatorIndex >= 0 ? fullName.slice(0, separatorIndex) : "unknown";
        const fileName =
            separatorIndex >= 0 ? fullName.slice(separatorIndex + 1) : fullName;

        filesByFolder.get(folder)!.push({
            fileId,
            fileName,
            size: object.size,
            lastModified: object.lastModified
        });
    }

    return Array.from(filesByFolder.entries()).map(([folder, files]) => {
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        const lastModified = files.reduce<Date | undefined>(
            (latest, file) =>
                !latest || (file.lastModified && file.lastModified > latest)
                    ? file.lastModified
                    : latest,
            undefined
        );

        const sortedFiles = files.sort((a, b) =>
            a.fileName.localeCompare(b.fileName)
        );

        return { folder, files: sortedFiles, totalSize, lastModified };
    });
}

/**
 * Reads a project file's contents as a stream, or `null` if it doesn't exist.
 */
async function readProjectFile(
    projectId: string,
    folder: string,
    fileId: string,
    fileName: string
) {
    const objectName = buildObjectName(projectId, folder, fileId, fileName);
    return await BucketService.readFile(PROJECT_FILES_BUCKET, objectName);
}

/* -------------------------------- DELETE -------------------------------- */

async function deleteProjectFile(
    projectId: string,
    folder: string,
    fileId: string,
    fileName: string
): Promise<void> {
    const objectName = buildObjectName(projectId, folder, fileId, fileName);
    await BucketService.deleteFile(PROJECT_FILES_BUCKET, objectName);
}

async function deleteCoverImage(coverImageKey: string): Promise<void> {
    await BucketService.deleteFile(PROJECT_FILES_BUCKET, coverImageKey);
}

/**
 * Deletes a folder and everything in it (its files and its FOLDER_MARKER,
 * if present).
 */
async function deleteProjectFolder(
    projectId: string,
    folder: string
): Promise<void> {
    const objects = await BucketService.listFiles({
        bucketName: PROJECT_FILES_BUCKET,
        prefix: `${projectId}/${folder}/`,
        recursive: true
    });

    const objectNames = objects
        .map((object) => object.name)
        .filter((name): name is string => Boolean(name));

    if (objectNames.length > 0) {
        await BucketService.deleteFiles(PROJECT_FILES_BUCKET, objectNames);
    }
}

export {
    PROJECT_FILES_BUCKET,
    COVER_IMAGE_FOLDER,
    buildObjectName,
    buildCoverObjectName,
    createProjectFolder,
    getProjectFileUploadUrl,
    saveProjectFileBuffer,
    getCoverImageUploadUrl,
    listProjectFiles,
    readProjectFile,
    deleteProjectFile,
    deleteProjectFolder,
    deleteCoverImage
};
