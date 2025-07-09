import { FastifyPluginAsync } from "fastify";
import { KafkaAdminService } from "../services/kafkaAdmin";
import { logger } from "../utils/logger";

export const topicsRoutes: FastifyPluginAsync = async (fastify) => {
  const kafkaAdmin = new KafkaAdminService();

  // Connect to Kafka admin on startup
  await kafkaAdmin.connect();

  // Graceful shutdown
  fastify.addHook("onClose", async () => {
    await kafkaAdmin.disconnect();
  });

  // List all topics
  fastify.get(
    "/topics",
    {
      schema: {
        description: "List all Kafka topics",
        tags: ["Topics"],
        response: {
          200: {
            type: "object",
            properties: {
              topics: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      try {
        const topics = await kafkaAdmin.listTopics();
        return { topics };
      } catch (error) {
        logger.error("Error listing topics:", error);
        throw fastify.httpErrors.internalServerError("Failed to list topics");
      }
    }
  );

  // Get topic metadata
  fastify.post(
    "/topics/metadata",
    {
      schema: {
        description: "Get metadata for specified topics",
        tags: ["Topics"],
        body: {
          type: "object",
          properties: {
            topics: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              metadata: { type: "object" },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      try {
        const { topics } = request.body as any;
        const metadata = await kafkaAdmin.getTopicMetadata(topics);
        return { metadata };
      } catch (error) {
        logger.error("Error fetching topic metadata:", error);
        throw fastify.httpErrors.internalServerError(
          "Failed to fetch topic metadata"
        );
      }
    }
  );

  // Create a new topic
  fastify.post(
    "/topics",
    {
      schema: {
        description: "Create a new Kafka topic",
        tags: ["Topics"],
        body: {
          type: "object",
          properties: {
            topic: { type: "string", minLength: 1 },
            numPartitions: { type: "integer", minimum: 1, default: 1 },
            replicationFactor: { type: "integer", minimum: 1, default: 1 },
            configEntries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  value: { type: "string" },
                },
                required: ["name", "value"],
              },
            },
          },
          required: ["topic"],
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { topic, numPartitions, replicationFactor, configEntries } =
          request.body as any;

        const topicConfig = {
          topic,
          numPartitions,
          replicationFactor,
          configEntries: configEntries || [],
        };

        const result = await kafkaAdmin.createTopic(topicConfig);

        reply.code(201);
        return {
          success: result,
          message: result
            ? `Topic '${topic}' created successfully`
            : `Topic '${topic}' already exists`,
        };
      } catch (error) {
        logger.error("Error creating topic:", error);
        throw fastify.httpErrors.internalServerError("Failed to create topic");
      }
    }
  );

  // Delete a topic
  fastify.delete(
    "/topics/:topic",
    {
      schema: {
        description: "Delete a Kafka topic",
        tags: ["Topics"],
        params: {
          type: "object",
          properties: {
            topic: { type: "string", minLength: 1 },
          },
          required: ["topic"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      try {
        const { topic } = request.params as any;
        await kafkaAdmin.deleteTopic(topic);

        return {
          success: true,
          message: `Topic '${topic}' deleted successfully`,
        };
      } catch (error) {
        logger.error("Error deleting topic:", error);
        throw fastify.httpErrors.internalServerError("Failed to delete topic");
      }
    }
  );

  // Get topic configuration
  fastify.get(
    "/topics/:topic/config",
    {
      schema: {
        description: "Get configuration for a specific topic",
        tags: ["Topics"],
        params: {
          type: "object",
          properties: {
            topic: { type: "string" },
          },
          required: ["topic"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              config: { type: "array" },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      try {
        const { topic } = request.params as any;
        const config = await kafkaAdmin.getTopicConfiguration(topic);

        return { config };
      } catch (error) {
        logger.error("Error fetching topic configuration:", error);
        throw fastify.httpErrors.internalServerError(
          "Failed to fetch topic configuration"
        );
      }
    }
  );
};
