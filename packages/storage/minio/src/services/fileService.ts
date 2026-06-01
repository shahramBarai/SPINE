import { type BucketItemStat } from "minio";
import { getMinioClient, type BUCKET_NAMES } from "../db/minio";

const minioClient = getMinioClient();

/* -------------------------------- INTERFACES -------------------------------- */

/* -------------------------------- CREATE -------------------------------- */

/* -------------------------------- READ -------------------------------- */

/**
 * Retrieves metadata and stat information about a specific file in MinIO.
 *
 * @param bucketName - The name of the bucket containing the file.
 * @param objectName - The object key / path within the bucket.
 * @returns File info object or null if the file does not exist or an error occurs.
 */
async function getFileInfo(
    bucketName: BUCKET_NAMES,
    objectName: string
): Promise<BucketItemStat | null> {
    try {
        const stat = await minioClient.statObject(bucketName, objectName);
        return stat;
    } catch (_error) {
        return null;
    }
}

/* -------------------------------- DELETE -------------------------------- */

export { getFileInfo };
