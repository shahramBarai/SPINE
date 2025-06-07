import { minioClient, BUCKET_NAMES } from "../../db/minio";
import { Readable } from "stream";

export interface UploadFileOptions {
  bucketName: string;
  objectName: string;
  stream: Readable;
  size?: number;
  metaData?: Record<string, string>;
}

export interface FileInfo {
  bucketName: string;
  objectName: string;
  etag: string;
  size: number;
  lastModified: Date;
  metaData?: Record<string, string>;
}

export interface ListFilesOptions {
  bucketName: string;
  prefix?: string;
  recursive?: boolean;
  maxKeys?: number;
}

export interface GeneratePresignedUrlOptions {
  bucketName: string;
  objectName: string;
  expiry?: number; // seconds, default 7 days
  reqParams?: Record<string, string>;
  requestDate?: Date;
}

export class FileStorageService {
  // Upload file to MinIO
  static async uploadFile(options: UploadFileOptions): Promise<string> {
    const { bucketName, objectName, stream, size, metaData } = options;

    // Ensure bucket exists
    await this.ensureBucket(bucketName);

    const result = await minioClient.putObject(
      bucketName,
      objectName,
      stream,
      size,
      metaData
    );

    return result.etag;
  }

  // Upload file from buffer
  static async uploadBuffer(
    bucketName: string,
    objectName: string,
    buffer: Buffer,
    metaData?: Record<string, string>
  ): Promise<string> {
    // Ensure bucket exists
    await this.ensureBucket(bucketName);

    const result = await minioClient.putObject(
      bucketName,
      objectName,
      buffer,
      buffer.length,
      metaData
    );

    return result.etag;
  }

  // Download file from MinIO
  static async downloadFile(
    bucketName: string,
    objectName: string
  ): Promise<Readable> {
    return minioClient.getObject(bucketName, objectName);
  }

  // Get file information
  static async getFileInfo(
    bucketName: string,
    objectName: string
  ): Promise<FileInfo> {
    const stat = await minioClient.statObject(bucketName, objectName);

    return {
      bucketName,
      objectName,
      etag: stat.etag,
      size: stat.size,
      lastModified: stat.lastModified,
      metaData: stat.metaData,
    };
  }

  // Delete file
  static async deleteFile(
    bucketName: string,
    objectName: string
  ): Promise<void> {
    await minioClient.removeObject(bucketName, objectName);
  }

  // Delete multiple files
  static async deleteFiles(
    bucketName: string,
    objectNames: string[]
  ): Promise<void> {
    await minioClient.removeObjects(bucketName, objectNames);
  }

  // List files in bucket
  static async listFiles(options: ListFilesOptions): Promise<FileInfo[]> {
    const { bucketName, prefix = "", recursive = false, maxKeys } = options;

    const files: FileInfo[] = [];
    const stream = minioClient.listObjects(bucketName, prefix, recursive);

    return new Promise((resolve, reject) => {
      let count = 0;

      stream.on("data", (obj) => {
        if (maxKeys && count >= maxKeys) {
          stream.destroy();
          resolve(files);
          return;
        }

        files.push({
          bucketName,
          objectName: obj.name!,
          etag: obj.etag!,
          size: obj.size!,
          lastModified: obj.lastModified!,
        });

        count++;
      });

      stream.on("error", reject);
      stream.on("end", () => resolve(files));
    });
  }

  // Generate presigned URL for file access
  static async generatePresignedUrl(
    options: GeneratePresignedUrlOptions
  ): Promise<string> {
    const {
      bucketName,
      objectName,
      expiry = 7 * 24 * 60 * 60,
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

  // Generate presigned URL for file upload
  static async generatePresignedUploadUrl(
    options: GeneratePresignedUrlOptions
  ): Promise<string> {
    const {
      bucketName,
      objectName,
      expiry = 7 * 24 * 60 * 60,
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

  // Copy file within MinIO
  static async copyFile(
    sourceBucket: string,
    sourceObject: string,
    destBucket: string,
    destObject: string,
    conditions?: any
  ): Promise<any> {
    // Ensure destination bucket exists
    await this.ensureBucket(destBucket);

    const result = await minioClient.copyObject(
      destBucket,
      destObject,
      `${sourceBucket}/${sourceObject}`,
      conditions
    );

    return result;
  }

  // Check if file exists
  static async fileExists(
    bucketName: string,
    objectName: string
  ): Promise<boolean> {
    try {
      await minioClient.statObject(bucketName, objectName);
      return true;
    } catch (error: any) {
      if (error.code === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  // Ensure bucket exists, create if not
  static async ensureBucket(bucketName: string): Promise<void> {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName);
    }
  }

  // Get bucket policy
  static async getBucketPolicy(bucketName: string): Promise<string> {
    return minioClient.getBucketPolicy(bucketName);
  }

  // Set bucket policy
  static async setBucketPolicy(
    bucketName: string,
    policy: string
  ): Promise<void> {
    await minioClient.setBucketPolicy(bucketName, policy);
  }

  // Initialize default buckets
  static async initializeDefaultBuckets(): Promise<void> {
    const bucketsToCreate = Object.values(BUCKET_NAMES);

    for (const bucketName of bucketsToCreate) {
      await this.ensureBucket(bucketName);
    }
  }

  // Get storage usage statistics
  static async getStorageStats(bucketName: string): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
  }> {
    const files = await this.listFiles({ bucketName, recursive: true });

    const stats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      filesByType: {} as Record<string, number>,
    };

    // Count files by extension
    files.forEach((file) => {
      const extension =
        file.objectName.split(".").pop()?.toLowerCase() || "unknown";
      stats.filesByType[extension] = (stats.filesByType[extension] || 0) + 1;
    });

    return stats;
  }

  // Clean up old files (older than specified days)
  static async cleanupOldFiles(
    bucketName: string,
    daysOld: number,
    prefix?: string
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const files = await this.listFiles({ bucketName, prefix, recursive: true });
    const oldFiles = files.filter((file) => file.lastModified < cutoffDate);

    if (oldFiles.length > 0) {
      const objectNames = oldFiles.map((file) => file.objectName);
      await this.deleteFiles(bucketName, objectNames);
    }

    return oldFiles.length;
  }
}
