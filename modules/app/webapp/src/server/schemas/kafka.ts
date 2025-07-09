import { z } from 'zod';

export const createTopicSchema = z.object({
  topic: z.string().min(1),
  numPartitions: z.number().int().positive().default(1),
  replicationFactor: z.number().int().positive().default(1),
  configEntries: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
});

export const deleteTopicSchema = z.object({
  topic: z.string().min(1),
});

export const topicMetadataSchema = z.object({
  topics: z.array(z.string()).optional(),
});

export const getConsumerGroupDetailsSchema = z.object({
  groupId: z.string().min(1),
});

export const getTopicConfigurationSchema = z.object({
  topicName: z.string().min(1),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type DeleteTopicInput = z.infer<typeof deleteTopicSchema>;
export type TopicMetadataInput = z.infer<typeof topicMetadataSchema>;
export type GetConsumerGroupDetailsInput = z.infer<typeof getConsumerGroupDetailsSchema>;
export type GetTopicConfigurationInput = z.infer<typeof getTopicConfigurationSchema>;