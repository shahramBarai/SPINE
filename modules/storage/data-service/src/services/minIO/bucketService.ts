import { minioClient } from "../../db/minio";
import { BucketItem, BucketItemStat } from "minio";

export interface BucketInfo {
  name: string;
  creationDate: Date;
}

export interface BucketStats {
  name: string;
  objectCount: number;
  totalSize: number;
  creationDate: Date;
}

export interface BucketNotification {
  TopicArn?: string;
  QueueArn?: string;
  CloudWatchConfiguration?: any;
  Events: string[];
  Filter?: {
    Key?: {
      FilterRules?: Array<{
        Name: string;
        Value: string;
      }>;
    };
  };
}

export class BucketService {
  // List all buckets
  static async listBuckets(): Promise<BucketInfo[]> {
    const buckets = await minioClient.listBuckets();
    return buckets.map((bucket) => ({
      name: bucket.name,
      creationDate: bucket.creationDate,
    }));
  }

  // Create a new bucket
  static async createBucket(
    bucketName: string,
    region?: string
  ): Promise<void> {
    await minioClient.makeBucket(bucketName, region);
  }

  // Delete a bucket (must be empty)
  static async deleteBucket(bucketName: string): Promise<void> {
    await minioClient.removeBucket(bucketName);
  }

  // Check if bucket exists
  static async bucketExists(bucketName: string): Promise<boolean> {
    return minioClient.bucketExists(bucketName);
  }

  // Get bucket statistics
  static async getBucketStats(bucketName: string): Promise<BucketStats> {
    const buckets = await minioClient.listBuckets();
    const bucket = buckets.find((b) => b.name === bucketName);

    if (!bucket) {
      throw new Error(`Bucket ${bucketName} not found`);
    }

    let objectCount = 0;
    let totalSize = 0;

    // List all objects to calculate stats
    const stream = minioClient.listObjects(bucketName, "", true);

    return new Promise((resolve, reject) => {
      stream.on("data", (obj: BucketItem) => {
        objectCount++;
        totalSize += obj.size || 0;
      });

      stream.on("error", reject);

      stream.on("end", () => {
        resolve({
          name: bucket.name,
          objectCount,
          totalSize,
          creationDate: bucket.creationDate,
        });
      });
    });
  }

  // Get bucket versioning configuration
  static async getBucketVersioning(bucketName: string): Promise<any> {
    try {
      return await minioClient.getBucketVersioning(bucketName);
    } catch (error: any) {
      if (error.code === "NotImplemented") {
        return { Status: "Disabled" };
      }
      throw error;
    }
  }

  // Set bucket versioning
  static async setBucketVersioning(
    bucketName: string,
    versioningConfig: any
  ): Promise<void> {
    await minioClient.setBucketVersioning(bucketName, versioningConfig);
  }

  // Get bucket lifecycle configuration
  static async getBucketLifecycle(bucketName: string): Promise<any> {
    try {
      return await minioClient.getBucketLifecycle(bucketName);
    } catch (error: any) {
      if (error.code === "NoSuchLifecycleConfiguration") {
        return null;
      }
      throw error;
    }
  }

  // Set bucket lifecycle configuration
  static async setBucketLifecycle(
    bucketName: string,
    lifecycleConfig: any
  ): Promise<void> {
    await minioClient.setBucketLifecycle(bucketName, lifecycleConfig);
  }

  // Delete bucket lifecycle configuration
  static async deleteBucketLifecycle(bucketName: string): Promise<void> {
    await minioClient.removeBucketLifecycle(bucketName);
  }

  // Get bucket notification configuration
  static async getBucketNotification(bucketName: string): Promise<any> {
    try {
      return await minioClient.getBucketNotification(bucketName);
    } catch (error: any) {
      if (error.code === "NotImplemented") {
        return {};
      }
      throw error;
    }
  }

  // Set bucket notification
  static async setBucketNotification(
    bucketName: string,
    notification: any
  ): Promise<void> {
    await minioClient.setBucketNotification(bucketName, notification);
  }

  // Remove all bucket notifications
  static async removeBucketNotification(bucketName: string): Promise<void> {
    await minioClient.removeAllBucketNotification(bucketName);
  }

  // Get bucket tagging
  static async getBucketTagging(
    bucketName: string
  ): Promise<Record<string, string>> {
    try {
      const tags = await minioClient.getBucketTagging(bucketName);
      // Convert Tag[] to Record<string, string>
      const tagsRecord: Record<string, string> = {};
      if (Array.isArray(tags)) {
        tags.forEach((tag: any) => {
          if (tag.Key && tag.Value) {
            tagsRecord[tag.Key] = tag.Value;
          }
        });
      }
      return tagsRecord;
    } catch (error: any) {
      if (error.code === "NoSuchTagSet") {
        return {};
      }
      throw error;
    }
  }

  // Set bucket tagging
  static async setBucketTagging(
    bucketName: string,
    tags: Record<string, string>
  ): Promise<void> {
    await minioClient.setBucketTagging(bucketName, tags);
  }

  // Remove bucket tagging
  static async removeBucketTagging(bucketName: string): Promise<void> {
    await minioClient.removeBucketTagging(bucketName);
  }

  // Get bucket encryption configuration
  static async getBucketEncryption(bucketName: string): Promise<any> {
    try {
      return await minioClient.getBucketEncryption(bucketName);
    } catch (error: any) {
      if (error.code === "ServerSideEncryptionConfigurationNotFoundError") {
        return null;
      }
      throw error;
    }
  }

  // Set bucket encryption
  static async setBucketEncryption(
    bucketName: string,
    encryptionConfig: any
  ): Promise<void> {
    await minioClient.setBucketEncryption(bucketName, encryptionConfig);
  }

  // Remove bucket encryption
  static async removeBucketEncryption(bucketName: string): Promise<void> {
    await minioClient.removeBucketEncryption(bucketName);
  }

  // Empty bucket (delete all objects)
  static async emptyBucket(bucketName: string): Promise<number> {
    let deletedCount = 0;
    const objectsToDelete: string[] = [];

    const stream = minioClient.listObjects(bucketName, "", true);

    return new Promise((resolve, reject) => {
      stream.on("data", (obj: BucketItem) => {
        if (obj.name) {
          objectsToDelete.push(obj.name);
        }
      });

      stream.on("error", reject);

      stream.on("end", async () => {
        try {
          if (objectsToDelete.length > 0) {
            await minioClient.removeObjects(bucketName, objectsToDelete);
            deletedCount = objectsToDelete.length;
          }
          resolve(deletedCount);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // Get all bucket statistics
  static async getAllBucketStats(): Promise<BucketStats[]> {
    const buckets = await this.listBuckets();
    const stats: BucketStats[] = [];

    for (const bucket of buckets) {
      try {
        const bucketStats = await this.getBucketStats(bucket.name);
        stats.push(bucketStats);
      } catch (error) {
        // Skip buckets that can't be accessed
        console.warn(`Failed to get stats for bucket ${bucket.name}:`, error);
      }
    }

    return stats;
  }

  // Create bucket with default settings
  static async createBucketWithDefaults(
    bucketName: string,
    options?: {
      region?: string;
      versioning?: boolean;
      encryption?: any;
      tags?: Record<string, string>;
    }
  ): Promise<void> {
    const { region, versioning = false, encryption, tags } = options || {};

    // Create bucket
    await this.createBucket(bucketName, region);

    // Set versioning if requested
    if (versioning) {
      await this.setBucketVersioning(bucketName, { Status: "Enabled" });
    }

    // Set encryption if provided
    if (encryption) {
      await this.setBucketEncryption(bucketName, encryption);
    }

    // Set tags if provided
    if (tags && Object.keys(tags).length > 0) {
      await this.setBucketTagging(bucketName, tags);
    }
  }
}
