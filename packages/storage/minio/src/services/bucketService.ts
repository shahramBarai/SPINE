import { BucketItemWithMetadata } from "minio"
import { minioClient, type BUCKET_NAMES } from "../db/minio";
import { Readable } from "stream";

/* -------------------------------- INTERFACES -------------------------------- */

/** Aggregated storage statistics for a bucket. */
interface StorageStats {
    totalFiles: number;
    totalSize: number;
    /** File counts keyed by lowercase file extension (e.g. `"png"`, `"csv"`). */
    filesByType: Record<string, number>;
}

/** Options for uploading a file stream to MinIO. */
interface UploadFileOptions {
    bucketName: BUCKET_NAMES;
    objectName: string;
    stream: Readable;
    size?: number;
    metaData?: Record<string, string>;
}

/** Options for listing files within a bucket. */
interface ListFilesOptions {
    bucketName: BUCKET_NAMES;
    prefix?: string;
    recursive?: boolean;
    maxKeys?: number;
}

/* -------------------------------- CREATE -------------------------------- */

/**
 * Uploads a readable stream as a file to a MinIO bucket.
 *
 * @param options - Upload configuration including bucket name, object name, stream, size, and optional metadata.
 * @returns A promise that resolves to the ETag string of the uploaded object or `null` if the upload failed.
 */
async function uploadFile(options: UploadFileOptions): Promise<string | null> {
    const { bucketName, objectName, stream, size, metaData } = options;

    try {
        const result = await minioClient.putObject(
            bucketName,
            objectName,
            stream,
            size,
            metaData
        );
        return result.etag;
    } catch (error) {
        return null;
    }
}

/**
 * Uploads a `Buffer` as a file to a MinIO bucket.
 *
 * @param bucketName - The name of the target bucket.
 * @param objectName - The object key / path within the bucket.
 * @param buffer - The file content as a `Buffer`.
 * @param metaData - Optional key-value metadata to attach to the object.
 * @returns A promise that resolves to the ETag string of the uploaded object or `null` if the upload failed.
 */
async function uploadBuffer(
    bucketName: BUCKET_NAMES,
    objectName: string,
    buffer: Buffer,
    metaData?: Record<string, string>
): Promise<string | null> {
    try {
        const result = await minioClient.putObject(
            bucketName,
            objectName,
            buffer,
            buffer.length,
            metaData
        );

        return result.etag;
    } catch (error) {
        return null;
    }
}

/**
 * Copies an object from a source bucket/key to a destination bucket/key within MinIO.
 *
 * Ensures the destination bucket exists before performing the copy.
 *
 * @param sourceBucket - The name of the source bucket.
 * @param sourceObject - The object key in the source bucket.
 * @param destBucket - The name of the destination bucket.
 * @param destObject - The object key in the destination bucket.
 * @param conditions - Optional copy conditions (e.g. `CopyConditions` from the MinIO SDK).
 * @returns A promise that resolves to the copy result object from MinIO.
 */
async function copyFile(
    sourceBucket: BUCKET_NAMES,
    sourceObject: string,
    destBucket: BUCKET_NAMES,
    destObject: string,
    conditions?: any
): Promise<any> {
    const result = await minioClient.copyObject(
        destBucket,
        destObject,
        `${sourceBucket}/${sourceObject}`,
        conditions
    );

    return result;
}

/* -------------------------------- READ -------------------------------- */

/**
 * Aggregates storage statistics for a given bucket, including total file count,
 * total size in bytes, and a breakdown of file counts grouped by file extension.
 *
 * @param bucketName - The name of the bucket to analyse.
 * @returns A promise that resolves to a `StorageStats` object.
 */
async function getStorageStats(bucketName: BUCKET_NAMES): Promise<StorageStats> {
    const files = await listFiles({ bucketName, recursive: true });

    const stats: StorageStats = {
        totalFiles: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        filesByType: {},
    };

    files.forEach((file) => {
        const extension =
            file.name?.split(".").pop()?.toLowerCase() || "unknown";
        stats.filesByType[extension] = (stats.filesByType[extension] || 0) + 1;
    });

    return stats;
}

/**
 * Downloads a file from MinIO and returns it as a `Readable` stream.
 *
 * @param bucketName - The name of the bucket containing the file.
 * @param objectName - The object key / path within the bucket.
 * @returns A promise that resolves to a `Readable` stream of the file content or `null` if the download failed.
 */
async function readFile(
    bucketName: BUCKET_NAMES,
    objectName: string
): Promise<Readable | null> {
    try {
        return minioClient.getObject(bucketName, objectName);
    } catch (error) {
        return null;
    }
}

/**
 * Lists all files within a bucket, with optional prefix filtering and key count limits.
 *
 * Internally uses a streaming MinIO list operation and collects results into an array.
 *
 * @param options - Listing configuration including bucket name, optional prefix, recursive flag, and max key count.
 * @returns A promise that resolves to an array of `FileInfo` objects for each matched object.
 */
async function listFiles({ bucketName, prefix = "", recursive = false, maxKeys }: ListFilesOptions): Promise<BucketItemWithMetadata[]> {
    const files: BucketItemWithMetadata[] = [];
    const stream = minioClient.extensions.listObjectsV2WithMetadata(bucketName, prefix, recursive);

    return new Promise((resolve, reject) => {
        let count = 0;

        stream.on("data", (obj) => {
            if (maxKeys && count >= maxKeys) {
                stream.destroy();
                resolve(files);
                return;
            }

            files.push(obj);

            count++;
        });

        stream.on("error", reject);
        stream.on("end", () => resolve(files));
    });
}

/* -------------------------------- UPDATE -------------------------------- */



/* -------------------------------- DELETE -------------------------------- */

/**
 * Deletes a single file (object) from a MinIO bucket.
 *
 * @param bucketName - The name of the bucket containing the file.
 * @param objectName - The object key / path of the file to delete.
 * @returns A promise that resolves when the object has been deleted.
 */
async function deleteFile(
    bucketName: BUCKET_NAMES,
    objectName: string
): Promise<void> {
    await minioClient.removeObject(bucketName, objectName);
}

/**
 * Deletes multiple files (objects) from a MinIO bucket in a single request.
 *
 * @param bucketName - The name of the bucket containing the files.
 * @param objectNames - An array of object keys / paths to delete.
 * @returns A promise that resolves when all specified objects have been deleted.
 */
async function deleteFiles(
    bucketName: BUCKET_NAMES,
    objectNames: string[]
): Promise<void> {
    await minioClient.removeObjects(bucketName, objectNames);
}

/**
 * Deletes all files in a bucket that are older than a specified number of days.
 *
 * Optionally scoped to a key prefix. Returns the number of files that were deleted.
 *
 * @param bucketName - The name of the bucket to clean up.
 * @param daysOld - Files last modified more than this many days ago will be removed.
 * @param prefix - Optional key prefix to restrict the cleanup scope.
 * @returns A promise that resolves to the number of deleted files.
 */
async function cleanupOldFiles(
    bucketName: BUCKET_NAMES,
    daysOld: number,
    prefix?: string
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const files = await listFiles({ bucketName, prefix, recursive: true });
    const oldFiles = files.filter((file) => file.lastModified! < cutoffDate);

    if (oldFiles.length > 0) {
        const objectNames = oldFiles.map((file) => file.name!);
        await deleteFiles(bucketName, objectNames);
    }

    return oldFiles.length;
}

export {
    uploadFile,
    uploadBuffer,
    copyFile,
    getStorageStats,
    readFile,
    listFiles,
    deleteFile,
    deleteFiles,
    cleanupOldFiles
}