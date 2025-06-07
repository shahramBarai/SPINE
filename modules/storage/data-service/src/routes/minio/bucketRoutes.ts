import { FastifyInstance } from "fastify";
import { BucketService } from "../../services/minIO";

export async function bucketRoutes(fastify: FastifyInstance) {
  // List all buckets
  fastify.get("/buckets", async (request, reply) => {
    try {
      const buckets = await BucketService.listBuckets();
      reply.send({ buckets, count: buckets.length });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Create bucket
  fastify.post("/buckets", async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.bucketName) {
        reply.code(400).send({ error: "bucketName is required" });
        return;
      }

      await BucketService.createBucket(body.bucketName, body.region);
      reply.code(201).send({
        bucketName: body.bucketName,
        message: "Bucket created successfully",
      });
    } catch (error: any) {
      if (error.code === "BucketAlreadyExists") {
        reply.code(409).send({ error: "Bucket already exists" });
      } else {
        reply.code(500).send({ error: error.message });
      }
    }
  });

  // Delete bucket
  fastify.delete("/buckets/:bucketName", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      await BucketService.deleteBucket(bucketName);
      reply.code(204).send();
    } catch (error: any) {
      if (error.code === "NoSuchBucket") {
        reply.code(404).send({ error: "Bucket not found" });
      } else if (error.code === "BucketNotEmpty") {
        reply.code(409).send({ error: "Bucket is not empty" });
      } else {
        reply.code(500).send({ error: error.message });
      }
    }
  });

  // Check if bucket exists
  fastify.get("/buckets/:bucketName/exists", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const exists = await BucketService.bucketExists(bucketName);
      reply.send({ exists });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get bucket statistics
  fastify.get("/buckets/:bucketName/stats", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const stats = await BucketService.getBucketStats(bucketName);
      reply.send(stats);
    } catch (error: any) {
      if (error.message.includes("not found")) {
        reply.code(404).send({ error: "Bucket not found" });
      } else {
        reply.code(500).send({ error: error.message });
      }
    }
  });

  // Get bucket versioning
  fastify.get("/buckets/:bucketName/versioning", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const versioning = await BucketService.getBucketVersioning(bucketName);
      reply.send(versioning);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Set bucket versioning
  fastify.put("/buckets/:bucketName/versioning", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };
      const body = request.body as any;

      if (!body.versioningConfig) {
        reply.code(400).send({ error: "versioningConfig is required" });
        return;
      }

      await BucketService.setBucketVersioning(
        bucketName,
        body.versioningConfig
      );
      reply.send({ message: "Bucket versioning updated successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get bucket lifecycle
  fastify.get("/buckets/:bucketName/lifecycle", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const lifecycle = await BucketService.getBucketLifecycle(bucketName);
      reply.send(lifecycle || { message: "No lifecycle configuration found" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Set bucket lifecycle
  fastify.put("/buckets/:bucketName/lifecycle", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };
      const body = request.body as any;

      if (!body.lifecycleConfig) {
        reply.code(400).send({ error: "lifecycleConfig is required" });
        return;
      }

      await BucketService.setBucketLifecycle(bucketName, body.lifecycleConfig);
      reply.send({ message: "Bucket lifecycle updated successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete bucket lifecycle
  fastify.delete("/buckets/:bucketName/lifecycle", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      await BucketService.deleteBucketLifecycle(bucketName);
      reply.send({ message: "Bucket lifecycle deleted successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get bucket notification
  fastify.get("/buckets/:bucketName/notification", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const notification = await BucketService.getBucketNotification(
        bucketName
      );
      reply.send(notification);
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Set bucket notification
  fastify.put("/buckets/:bucketName/notification", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };
      const body = request.body as any;

      if (!body.notification) {
        reply.code(400).send({ error: "notification is required" });
        return;
      }

      await BucketService.setBucketNotification(bucketName, body.notification);
      reply.send({ message: "Bucket notification updated successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Remove bucket notification
  fastify.delete(
    "/buckets/:bucketName/notification",
    async (request, reply) => {
      try {
        const { bucketName } = request.params as { bucketName: string };

        await BucketService.removeBucketNotification(bucketName);
        reply.send({ message: "Bucket notification removed successfully" });
      } catch (error: any) {
        reply.code(500).send({ error: error.message });
      }
    }
  );

  // Get bucket tagging
  fastify.get("/buckets/:bucketName/tags", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const tags = await BucketService.getBucketTagging(bucketName);
      reply.send({ tags });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Set bucket tagging
  fastify.put("/buckets/:bucketName/tags", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };
      const body = request.body as any;

      if (!body.tags || typeof body.tags !== "object") {
        reply.code(400).send({ error: "tags object is required" });
        return;
      }

      await BucketService.setBucketTagging(bucketName, body.tags);
      reply.send({ message: "Bucket tags updated successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Remove bucket tagging
  fastify.delete("/buckets/:bucketName/tags", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      await BucketService.removeBucketTagging(bucketName);
      reply.send({ message: "Bucket tags removed successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get bucket encryption
  fastify.get("/buckets/:bucketName/encryption", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const encryption = await BucketService.getBucketEncryption(bucketName);
      reply.send(
        encryption || { message: "No encryption configuration found" }
      );
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Set bucket encryption
  fastify.put("/buckets/:bucketName/encryption", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };
      const body = request.body as any;

      if (!body.encryptionConfig) {
        reply.code(400).send({ error: "encryptionConfig is required" });
        return;
      }

      await BucketService.setBucketEncryption(
        bucketName,
        body.encryptionConfig
      );
      reply.send({ message: "Bucket encryption updated successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Remove bucket encryption
  fastify.delete("/buckets/:bucketName/encryption", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      await BucketService.removeBucketEncryption(bucketName);
      reply.send({ message: "Bucket encryption removed successfully" });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Empty bucket
  fastify.delete("/buckets/:bucketName/empty", async (request, reply) => {
    try {
      const { bucketName } = request.params as { bucketName: string };

      const deletedCount = await BucketService.emptyBucket(bucketName);
      reply.send({
        deletedCount,
        message: `Deleted ${deletedCount} objects from bucket`,
      });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get all bucket statistics
  fastify.get("/buckets/stats/all", async (request, reply) => {
    try {
      const allStats = await BucketService.getAllBucketStats();
      reply.send({ buckets: allStats, count: allStats.length });
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Create bucket with defaults
  fastify.post("/buckets/with-defaults", async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.bucketName) {
        reply.code(400).send({ error: "bucketName is required" });
        return;
      }

      await BucketService.createBucketWithDefaults(
        body.bucketName,
        body.options
      );
      reply.code(201).send({
        bucketName: body.bucketName,
        message: "Bucket created with default settings successfully",
      });
    } catch (error: any) {
      if (error.code === "BucketAlreadyExists") {
        reply.code(409).send({ error: "Bucket already exists" });
      } else {
        reply.code(500).send({ error: error.message });
      }
    }
  });
}
