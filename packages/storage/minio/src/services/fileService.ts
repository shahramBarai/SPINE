import { minioClient, type BUCKET_NAMES } from "../db/minio";

/* -------------------------------- INTERFACES -------------------------------- */

/** Metadata and identity information about a stored file. */
interface FileInfo {
    bucketName: BUCKET_NAMES;
    objectName: string;
    etag: string;
    size: number;
    lastModified: Date;
    metaData?: Record<string, string>;
}

/* -------------------------------- CREATE -------------------------------- */

/* -------------------------------- READ -------------------------------- */

/**
 * Retrieves metadata and stat information about a specific file in MinIO.
 *
 * @param bucketName - The name of the bucket containing the file.
 * @param objectName - The object key / path within the bucket.
 * @returns File info object or null if the file does not exist.
 * @throws Error if an unexpected error occurs.
 */
async function getFileInfo(
    bucketName: BUCKET_NAMES,
    objectName: string
): Promise<FileInfo | null> {

    try {
        const stat = await minioClient.statObject(bucketName, objectName);
        return {
            bucketName: bucketName as BUCKET_NAMES,
            objectName,
            etag: stat.etag,
            size: stat.size,
            lastModified: stat.lastModified,
            metaData: stat.metaData,
        };
    } catch (error: any) {
        if (error.code === "NotFound") {
            return null;
        }
        throw error;
    }
}

/* -------------------------------- DELETE -------------------------------- */


export {
    getFileInfo
};