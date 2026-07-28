import { prisma } from "../../prisma/client";

/* -------------------------------- CREATE -------------------------------- */

/**
 * Registers a project file that has already been uploaded to MinIO - the
 * authoritative record of its existence/metadata. `id` is not generated
 * here: it's the same fileId minted by
 * ProjectFileService.getProjectFileUploadUrl, so MinIO's object key and
 * this row share one identifier.
 */
async function createFile(data: {
    id: string;
    entityId: string;
    fileName: string;
    size: number;
    mimeType: string;
    objectKey: string;
    createdBy: string;
}) {
    return await prisma.file.create({ data });
}

/* -------------------------------- READ -------------------------------- */

/**
 * Lists a project's files, most recently updated discipline assignment aside -
 * ordered by file name for a stable listing.
 */
async function listFiles(entityId: string) {
    return await prisma.file.findMany({
        where: { entityId },
        orderBy: { fileName: "asc" }
    });
}

/**
 * A single file, scoped to the project it must belong to.
 * @returns The file, or `null` if it doesn't exist or belongs to a different project
 */
async function getFile(entityId: string, fileId: string) {
    return await prisma.file.findFirst({
        where: { id: fileId, entityId }
    });
}

/* -------------------------------- DELETE -------------------------------- */

/**
 * Deletes a project file's record. A no-op if it doesn't exist or belongs
 * to a different project.
 */
async function deleteFile(entityId: string, fileId: string): Promise<void> {
    await prisma.file.deleteMany({ where: { id: fileId, entityId } });
}

export { createFile, listFiles, getFile, deleteFile };
