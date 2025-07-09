import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { getKafkaAdminService } from "../services/kafka";
import {
  createTopicSchema,
  deleteTopicSchema,
  topicMetadataSchema,
  getConsumerGroupDetailsSchema,
  getTopicConfigurationSchema,
} from "../schemas/kafka";

export const kafkaRouter = router({
  // List all topics
  listTopics: protectedProcedure.query(async () => {
    try {
      const kafkaAdmin = getKafkaAdminService();
      await kafkaAdmin.connect();
      const topics = await kafkaAdmin.listTopics();
      await kafkaAdmin.disconnect();
      return topics;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list topics",
        cause: error,
      });
    }
  }),

  // Get topic metadata
  getTopicMetadata: protectedProcedure
    .input(topicMetadataSchema)
    .query(async ({ input }) => {
      try {
        const kafkaAdmin = getKafkaAdminService();
        await kafkaAdmin.connect();
        const metadata = await kafkaAdmin.getTopicMetadata(input.topics);
        await kafkaAdmin.disconnect();
        return metadata;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch topic metadata",
          cause: error,
        });
      }
    }),

  // Create a new topic
  createTopic: protectedProcedure
    .input(createTopicSchema)
    .mutation(async ({ input }) => {
      try {
        const kafkaAdmin = getKafkaAdminService();
        await kafkaAdmin.connect();
        
        const topicConfig = {
          topic: input.topic,
          numPartitions: input.numPartitions,
          replicationFactor: input.replicationFactor,
          configEntries: input.configEntries,
        };
        
        const result = await kafkaAdmin.createTopic(topicConfig);
        await kafkaAdmin.disconnect();
        
        return { success: result, topic: input.topic };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create topic: ${input.topic}`,
          cause: error,
        });
      }
    }),

  // Delete a topic
  deleteTopic: protectedProcedure
    .input(deleteTopicSchema)
    .mutation(async ({ input }) => {
      try {
        const kafkaAdmin = getKafkaAdminService();
        await kafkaAdmin.connect();
        await kafkaAdmin.deleteTopic(input.topic);
        await kafkaAdmin.disconnect();
        
        return { success: true, topic: input.topic };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete topic: ${input.topic}`,
          cause: error,
        });
      }
    }),

  // Get topic configuration
  getTopicConfiguration: protectedProcedure
    .input(getTopicConfigurationSchema)
    .query(async ({ input }) => {
      try {
        const kafkaAdmin = getKafkaAdminService();
        await kafkaAdmin.connect();
        const config = await kafkaAdmin.getTopicConfiguration(input.topicName);
        await kafkaAdmin.disconnect();
        return config;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get configuration for topic: ${input.topicName}`,
          cause: error,
        });
      }
    }),

  // Get cluster information
  getClusterInfo: protectedProcedure.query(async () => {
    try {
      const kafkaAdmin = getKafkaAdminService();
      await kafkaAdmin.connect();
      const cluster = await kafkaAdmin.getClusterInfo();
      await kafkaAdmin.disconnect();
      return cluster;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get cluster info",
        cause: error,
      });
    }
  }),

  // List consumer groups
  getConsumerGroups: protectedProcedure.query(async () => {
    try {
      const kafkaAdmin = getKafkaAdminService();
      await kafkaAdmin.connect();
      const groups = await kafkaAdmin.getConsumerGroups();
      await kafkaAdmin.disconnect();
      return groups;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list consumer groups",
        cause: error,
      });
    }
  }),

  // Get consumer group details
  getConsumerGroupDetails: protectedProcedure
    .input(getConsumerGroupDetailsSchema)
    .query(async ({ input }) => {
      try {
        const kafkaAdmin = getKafkaAdminService();
        await kafkaAdmin.connect();
        const groupDetails = await kafkaAdmin.getConsumerGroupDetails(input.groupId);
        await kafkaAdmin.disconnect();
        return groupDetails;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get consumer group details for: ${input.groupId}`,
          cause: error,
        });
      }
    }),
});