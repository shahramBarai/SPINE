import { minioClient, type BUCKET_NAMES } from "../db/minio";

/* -------------------------------- INTERFACES -------------------------------- */

/** Options for generating a presigned URL for object access or upload. */
export interface GeneratePresignedUrlOptions {
    bucketName: BUCKET_NAMES;
    objectName: string;
    /** Expiry duration in seconds. Defaults to 1 hour (3600 s). */
    expiry?: number;
    reqParams?: Record<string, string>;
    requestDate?: Date;
}

/* -------------------------------- CREATE -------------------------------- */

/**
 * Generates a presigned URL that allows a client to **upload** (PUT) a file
 * directly to MinIO without requiring MinIO credentials.
 *
 * The URL is time-limited and expires after `options.expiry` seconds
 * (default: 1 hour).
 *
 * @param bucketName - The name of the target bucket.
 * @param objectName - The object key / path within the bucket.
 * @param expiry - Expiry duration in seconds (optional, default: 3600).
 * @param reqParams - Extra request parameters (optional).
 * @param requestDate - Request date (optional).
 * @returns A promise that resolves to the presigned PUT URL string.
 */
async function generatePresignedUploadUrl(
    options: GeneratePresignedUrlOptions
): Promise<string> {
    const {
        bucketName,
        objectName,
        expiry = 3600,
        reqParams,
        requestDate,
    } = options;

    return minioClient.presignedUrl(
        "PUT",
        bucketName,
        objectName,
        expiry,
        reqParams,
        requestDate
    );
}

/* -------------------------------- READ -------------------------------- */

/**
 * Generates a presigned URL that allows a client to **download** (GET) a file
 * directly from MinIO without requiring MinIO credentials.
 *
 * The URL is time-limited and expires after `options.expiry` seconds
 * (default: 1 hour).
 *
 * @param bucketName - The name of the target bucket.
 * @param objectName - The object key / path within the bucket.
 * @param expiry - Expiry duration in seconds (optional, default: 3600).
 * @param reqParams - Extra request parameters (optional).
 * @param requestDate - Request date (optional).
 * @returns A promise that resolves to the presigned GET URL string.
 */
async function generatePresignedUrl(
    options: GeneratePresignedUrlOptions
): Promise<string> {
    const {
        bucketName,
        objectName,
        expiry = 3600,
        reqParams,
        requestDate,
    } = options;

    return minioClient.presignedUrl(
        "GET",
        bucketName,
        objectName,
        expiry,
        reqParams,
        requestDate
    );
}

export {
    generatePresignedUrl,
    generatePresignedUploadUrl
}

