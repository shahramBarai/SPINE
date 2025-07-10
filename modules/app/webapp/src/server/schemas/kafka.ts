import { z } from "zod";
import type { GroupOverview, GroupDescription, ConfigEntries } from "kafkajs";

const createTopicSchema = z.object({
  topic: z.string().min(1),
  numPartitions: z.number().int().positive().default(1),
  replicationFactor: z.number().int().positive().default(1),
  configEntries: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      })
    )
    .optional(),
});

const deleteTopicSchema = z.object({
  topic: z.string().min(1),
});

const topicMetadataSchema = z.object({
  topics: z.array(z.string()).optional(),
});

const getConsumerGroupDetailsSchema = z.object({
  groupId: z.string().min(1),
});

const getTopicConfigurationSchema = z.object({
  topicName: z.string().min(1),
});

type CreateTopicInput = z.infer<typeof createTopicSchema>;
type DeleteTopicInput = z.infer<typeof deleteTopicSchema>;
type TopicMetadataInput = z.infer<typeof topicMetadataSchema>;
type GetConsumerGroupDetailsInput = z.infer<
  typeof getConsumerGroupDetailsSchema
>;
type GetTopicConfigurationInput = z.infer<typeof getTopicConfigurationSchema>;

// Response types
interface KafkaHealthResponse {
  status: "connected" | "disconnected";
  brokersCount?: number;
  controllerId?: number;
  clusterId?: string;
  error?: string;
}

interface KafkaClusterInfo {
  clusterId: string;
  controller: number | null;
  brokers: Array<{
    nodeId: number;
    host: string;
    port: number;
  }>;
}

export interface ConsumerGroupsResponse {
  groups: GroupOverview[];
}

/** ---------------------- EXPORTS ---------------------- */

export type {
  CreateTopicInput,
  DeleteTopicInput,
  TopicMetadataInput,
  GetConsumerGroupDetailsInput,
  GetTopicConfigurationInput,
  KafkaHealthResponse,
  KafkaClusterInfo,
  GroupOverview,
  GroupDescription,
  ConfigEntries,
};

export {
  createTopicSchema,
  deleteTopicSchema,
  topicMetadataSchema,
  getConsumerGroupDetailsSchema,
  getTopicConfigurationSchema,
};
