// Export all service classes
export { FileStorageService } from "./fileStorageService";
export { BucketService } from "./bucketService";

// Export all interfaces
export type {
  UploadFileOptions,
  FileInfo,
  ListFilesOptions,
  GeneratePresignedUrlOptions,
} from "./fileStorageService";

export type {
  BucketInfo,
  BucketStats,
  BucketNotification,
} from "./bucketService";

// Export bucket names constant
export { BUCKET_NAMES } from "../../db/minio";
