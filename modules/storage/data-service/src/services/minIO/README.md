# MinIO Services

This directory contains services that manage file storage using MinIO's S3-compatible object storage. These services provide file lifecycle management, metadata tracking, and secure access to binary assets.

## Service Overview

MinIO services abstract S3-compatible object storage operations, providing comprehensive file management with metadata coordination and cloud-ready storage patterns.

### Core Services

- **[fileStorageService.ts](fileStorageService.ts)** - File operations and metadata management
- **[bucketService.ts](bucketService.ts)** - Bucket management and storage policies

## Service Responsibilities

### FileStorageService

- File upload and download operations
- Metadata tracking and search capabilities
- Presigned URL generation for direct access
- File lifecycle and cleanup automation
- Binary asset management
- Export and archive coordination

### BucketService

- Bucket creation and configuration
- Lifecycle policy management
- Versioning and encryption settings
- Storage statistics and monitoring
- Access control and permissions
- Cross-bucket operations

## S3-Compatible Patterns

MinIO services implement standard S3 operations with enhanced metadata:

```typescript
// File operations
uploadFile(bucketName: string, fileName: string, fileData: Buffer): Promise<FileMetadata>
downloadFile(bucketName: string, fileName: string): Promise<Buffer>
deleteFile(bucketName: string, fileName: string): Promise<void>

// Presigned URLs for direct access
generatePresignedUploadUrl(bucketName: string, fileName: string, expiry?: number): Promise<string>
generatePresignedDownloadUrl(bucketName: string, fileName: string, expiry?: number): Promise<string>

// Metadata operations
getFileMetadata(bucketName: string, fileName: string): Promise<FileMetadata | null>
updateFileMetadata(bucketName: string, fileName: string, metadata: Partial<FileMetadata>): Promise<FileMetadata>
```

## Metadata Coordination

### Dual-Layer Architecture

MinIO services coordinate file content with PostgreSQL metadata:

```typescript
// File storage with metadata tracking
async uploadFileWithMetadata(uploadData: FileUploadData) {
  // Store file in MinIO
  const fileInfo = await this.minioClient.putObject(bucket, fileName, fileData)

  // Track metadata in PostgreSQL
  const metadata = await this.platformService.createFileMetadata({
    fileName,
    size: fileInfo.size,
    contentType: uploadData.contentType,
    uploadedBy: uploadData.userId,
    bucket,
    objectKey: fileName
  })

  return metadata
}
```

### Searchable Metadata

- File indexing in PostgreSQL for efficient search
- Tagging and categorization support
- Owner and project association tracking
- Access audit trails

## Storage Policies

### Lifecycle Management

- Automatic migration to cold storage after configurable periods
- Retention policies based on file age and usage patterns
- Cleanup automation for temporary files
- Archive coordination with long-term storage

### Security Features

- Bucket-level access controls
- Encryption at rest configuration
- Secure presigned URL generation with expiration
- Cross-origin resource sharing (CORS) policies

### Storage Optimization

- Multi-part upload support for large files
- Compression policies for applicable file types
- Deduplication strategies for common assets
- Storage usage monitoring and reporting

## Integration Patterns

### Platform Coordination

MinIO services integrate with platform metadata services:

```typescript
// Example: Project-scoped file access
async getProjectFiles(projectId: string, userId: string): Promise<FileMetadata[]> {
  // Verify user access to project
  await this.platformService.verifyProjectAccess(projectId, userId)

  // Retrieve project files
  return await this.platformService.getFilesByProject(projectId)
}
```

### Export Operations

- Historical data export from TimescaleDB to MinIO
- Pipeline artifact storage and retrieval
- Backup and disaster recovery coordination
- Cross-service file sharing

## Cloud Migration Support

### S3 Compatibility

- Standard S3 API operations for seamless cloud migration
- Compatible bucket policies and lifecycle rules
- Cross-provider replication support
- Migration utilities for cloud transitions

### Environment Flexibility

- Local deployment with MinIO containers
- Cloud deployment with managed S3 services
- Hybrid deployments with cross-region replication
- Development/production environment parity

These services provide robust, scalable file storage capabilities with cloud migration paths and comprehensive metadata management, supporting the platform's binary asset requirements while maintaining operational flexibility.
