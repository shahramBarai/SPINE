import { FastifyInstance } from "fastify";
import {
  FileStorageService,
  UploadFileOptions,
  ListFilesOptions,
  GeneratePresignedUrlOptions,
} from "../../services/minIO";
import { Readable } from "stream";

export async function fileStorageRoutes(fastify: FastifyInstance) {
  // Upload file
  fastify.post("/files/upload", async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        reply.code(400).send({ error: "No file provided" });
        return;
      }

      const bucketName = (request.query as any).bucket || "user-uploads";
      const objectName = data.filename || `file-${Date.now()}`;

      const options: UploadFileOptions = {
        bucketName,
        objectName,
        stream: data.file,
        metaData: {
          "content-type": data.mimetype || "application/octet-stream",
          "uploaded-at": new Date().toISOString(),
        },
      };

      const etag = await FileStorageService.uploadFile(options);

      reply.code(201).send({
        bucketName,
        objectName,
        etag,
        message: "File uploaded successfully",
      });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Upload buffer
  fastify.post("/files/upload-buffer", async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.bucketName || !body.objectName || !body.buffer) {
        reply.code(400).send({
          error: "bucketName, objectName, and buffer are required",
        });
        return;
      }

      const buffer = Buffer.from(body.buffer, "base64");

      const etag = await FileStorageService.uploadBuffer(
        body.bucketName,
        body.objectName,
        buffer,
        body.metaData
      );

      reply.code(201).send({
        bucketName: body.bucketName,
        objectName: body.objectName,
        etag,
        message: "Buffer uploaded successfully",
      });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Download file
  fastify.get("/files/download/:bucket/:objectName", async (request, reply) => {
    try {
      const { bucket, objectName } = request.params as {
        bucket: string;
        objectName: string;
      };

      const stream = await FileStorageService.downloadFile(bucket, objectName);

      reply.type("application/octet-stream");
      reply.header(
        "Content-Disposition",
        `attachment; filename="${objectName}"`
      );
      reply.send(stream);
    } catch (error: any) {
      if (error.code === "NoSuchKey") {
        reply.code(404).send({ error: "File not found" });
      } else {
        reply.code(500).send({ error: error.message });
      }
    }
  });

  // Get file info
  fastify.get("/files/info/:bucket/:objectName", async (request, reply) => {
    try {
      const { bucket, objectName } = request.params as {
        bucket: string;
        objectName: string;
      };

      const fileInfo = await FileStorageService.getFileInfo(bucket, objectName);
      reply.send(fileInfo);
    } catch (error: any) {
      if (error.code === "NotFound") {
        reply.code(404).send({ error: "File not found" });
      } else {
        reply.code(500).send({ error: error.message });
      }
    }
  });

  // Delete file
  fastify.delete("/files/:bucket/:objectName", async (request, reply) => {
    try {
      const { bucket, objectName } = request.params as {
        bucket: string;
        objectName: string;
      };

      await FileStorageService.deleteFile(bucket, objectName);
      reply.code(204).send();
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete multiple files
  fastify.delete("/files/bulk/:bucket", async (request, reply) => {
    try {
      const { bucket } = request.params as { bucket: string };
      const body = request.body as { objectNames: string[] };

      if (!body.objectNames || !Array.isArray(body.objectNames)) {
        reply.code(400).send({ error: "objectNames array is required" });
        return;
      }

      await FileStorageService.deleteFiles(bucket, body.objectNames);
      reply.code(204).send();
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // List files in bucket
  fastify.get("/files/list/:bucket", async (request, reply) => {
    try {
      const { bucket } = request.params as { bucket: string };
      const query = request.query as any;

      const options: ListFilesOptions = {
        bucketName: bucket,
        prefix: query.prefix,
        recursive: query.recursive === "true",
        maxKeys: query.maxKeys ? parseInt(query.maxKeys) : undefined,
      };

      const files = await FileStorageService.listFiles(options);
      reply.send({ files, count: files.length });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Generate presigned URL for download
  fastify.post("/files/presigned-url/download", async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.bucketName || !body.objectName) {
        reply
          .code(400)
          .send({ error: "bucketName and objectName are required" });
        return;
      }

      const options: GeneratePresignedUrlOptions = {
        bucketName: body.bucketName,
        objectName: body.objectName,
        expiry: body.expiry || 7 * 24 * 60 * 60, // 7 days default
        reqParams: body.reqParams,
        requestDate: body.requestDate ? new Date(body.requestDate) : undefined,
      };

      const url = await FileStorageService.generatePresignedUrl(options);
      reply.send({ url, expiresIn: options.expiry });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Generate presigned URL for upload
  fastify.post("/files/presigned-url/upload", async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.bucketName || !body.objectName) {
        reply
          .code(400)
          .send({ error: "bucketName and objectName are required" });
        return;
      }

      const options: GeneratePresignedUrlOptions = {
        bucketName: body.bucketName,
        objectName: body.objectName,
        expiry: body.expiry || 60 * 60, // 1 hour default for uploads
        reqParams: body.reqParams,
        requestDate: body.requestDate ? new Date(body.requestDate) : undefined,
      };

      const url = await FileStorageService.generatePresignedUploadUrl(options);
      reply.send({ url, expiresIn: options.expiry });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Copy file
  fastify.post("/files/copy", async (request, reply) => {
    try {
      const body = request.body as any;

      if (
        !body.sourceBucket ||
        !body.sourceObject ||
        !body.destBucket ||
        !body.destObject
      ) {
        reply.code(400).send({
          error:
            "sourceBucket, sourceObject, destBucket, and destObject are required",
        });
        return;
      }

      const result = await FileStorageService.copyFile(
        body.sourceBucket,
        body.sourceObject,
        body.destBucket,
        body.destObject,
        body.conditions
      );

      reply.send({
        sourceBucket: body.sourceBucket,
        sourceObject: body.sourceObject,
        destBucket: body.destBucket,
        destObject: body.destObject,
        result,
        message: "File copied successfully",
      });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Check if file exists
  fastify.get("/files/exists/:bucket/:objectName", async (request, reply) => {
    try {
      const { bucket, objectName } = request.params as {
        bucket: string;
        objectName: string;
      };

      const exists = await FileStorageService.fileExists(bucket, objectName);
      reply.send({ exists });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get storage statistics
  fastify.get("/files/stats/:bucket", async (request, reply) => {
    try {
      const { bucket } = request.params as { bucket: string };

      const stats = await FileStorageService.getStorageStats(bucket);
      reply.send(stats);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Clean up old files
  fastify.delete("/files/cleanup/:bucket", async (request, reply) => {
    try {
      const { bucket } = request.params as { bucket: string };
      const query = request.query as any;

      if (!query.daysOld) {
        reply.code(400).send({ error: "daysOld query parameter is required" });
        return;
      }

      const daysOld = parseInt(query.daysOld);
      const deletedCount = await FileStorageService.cleanupOldFiles(
        bucket,
        daysOld,
        query.prefix
      );

      reply.send({
        deletedCount,
        message: `Cleaned up ${deletedCount} files older than ${daysOld} days`,
      });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Initialize default buckets
  fastify.post("/files/init-buckets", async (request, reply) => {
    try {
      await FileStorageService.initializeDefaultBuckets();
      reply.send({ message: "Default buckets initialized successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
}
