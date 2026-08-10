import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { adminProcedure } from "../procedures/admin";
import { KafkaAdminClient } from "../clients";

// Backs the /admin/kafka page (components/feature/kafka). Every procedure is
// admin-only: these read and mutate cluster-wide state, not project-scoped
// data, so the per-project tiers in procedures/project.ts don't apply.

interface KafkaHealth {
    status: "connected" | "disconnected";
    brokersCount?: number;
    controllerId?: number;
    clusterId?: string;
    error?: string;
}

const createTopicSchema = z.object({
    topic: z.string().min(1),
    numPartitions: z.number().int().positive().default(1),
    replicationFactor: z.number().int().positive().default(1),
    configEntries: z
        .array(z.object({ name: z.string(), value: z.string() }))
        .optional()
});

const topicSchema = z.object({ topic: z.string().min(1) });
const topicNameSchema = z.object({ topicName: z.string().min(1) });
const topicMetadataSchema = z.object({
    topics: z.array(z.string()).optional()
});
const consumerGroupSchema = z.object({ groupId: z.string().min(1) });

function asInternalError(error: unknown, message: string): TRPCError {
    return new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message,
        cause: error
    });
}

export const kafkaRouter = router({
    /**
     * Reports the broker connection as data rather than throwing, so the
     * page's status card can render a "disconnected" state instead of an
     * error boundary.
     */
    healthCheck: adminProcedure.query(async (): Promise<KafkaHealth> => {
        try {
            const cluster = await KafkaAdminClient.getClusterInfo();

            return {
                status: "connected",
                brokersCount: cluster.brokers?.length ?? 0,
                controllerId: cluster.controller ?? undefined,
                clusterId: cluster.clusterId
            };
        } catch (error) {
            return {
                status: "disconnected",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }),

    getClusterInfo: adminProcedure.query(async () => {
        try {
            return await KafkaAdminClient.getClusterInfo();
        } catch (error) {
            throw asInternalError(error, "Failed to get cluster info");
        }
    }),

    listTopics: adminProcedure.query(async () => {
        try {
            return await KafkaAdminClient.listTopics();
        } catch (error) {
            throw asInternalError(error, "Failed to list topics");
        }
    }),

    getTopicMetadata: adminProcedure
        .input(topicMetadataSchema)
        .query(async ({ input }) => {
            try {
                return await KafkaAdminClient.getTopicMetadata(input.topics);
            } catch (error) {
                throw asInternalError(error, "Failed to fetch topic metadata");
            }
        }),

    getTopicConfiguration: adminProcedure
        .input(topicNameSchema)
        .query(async ({ input }) => {
            try {
                return await KafkaAdminClient.getTopicConfiguration(
                    input.topicName
                );
            } catch (error) {
                throw asInternalError(
                    error,
                    `Failed to get configuration for topic: ${input.topicName}`
                );
            }
        }),

    createTopic: adminProcedure
        .input(createTopicSchema)
        .mutation(async ({ input }) => {
            try {
                const created = await KafkaAdminClient.createTopic({
                    topic: input.topic,
                    numPartitions: input.numPartitions,
                    replicationFactor: input.replicationFactor,
                    configEntries: input.configEntries
                });

                return { success: created, topic: input.topic };
            } catch (error) {
                throw asInternalError(
                    error,
                    `Failed to create topic: ${input.topic}`
                );
            }
        }),

    deleteTopic: adminProcedure
        .input(topicSchema)
        .mutation(async ({ input }) => {
            try {
                await KafkaAdminClient.deleteTopic(input.topic);
                return { success: true, topic: input.topic };
            } catch (error) {
                throw asInternalError(
                    error,
                    `Failed to delete topic: ${input.topic}`
                );
            }
        }),

    getConsumerGroups: adminProcedure.query(async () => {
        try {
            return await KafkaAdminClient.listConsumerGroups();
        } catch (error) {
            throw asInternalError(error, "Failed to list consumer groups");
        }
    }),

    getConsumerGroupDetails: adminProcedure
        .input(consumerGroupSchema)
        .query(async ({ input }) => {
            try {
                return await KafkaAdminClient.describeConsumerGroup(
                    input.groupId
                );
            } catch (error) {
                throw asInternalError(
                    error,
                    `Failed to get consumer group details for: ${input.groupId}`
                );
            }
        })
});
