import {
    Kafka,
    ConfigResourceTypes,
    type Admin,
    type ConfigEntries,
    type GroupDescription,
    type GroupOverview,
    type ITopicConfig,
    type ITopicMetadata
} from "kafkajs";
import { env } from "@spine/shared";

// Thin wrapper over kafkajs' admin client, backing the /admin/kafka page.
// Only the admin surface (cluster metadata, topic and consumer-group
// management) lives here - producing and consuming records is the pipeline
// modules' job, not the web app's.

interface ClusterInfo {
    clusterId: string;
    controller: number | null;
    brokers: Array<{
        nodeId: number;
        host: string;
        port: number;
    }>;
}

const CLIENT_ID = "spine-backend-admin";
const CONNECTION_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

let adminConnection: Promise<Admin> | null = null;

/**
 * Lazily opens a single shared admin connection and reuses it for the
 * process's lifetime. The webapp instead connected and disconnected around
 * every procedure call, which raced: the Kafka page fires four queries at
 * once and whichever finished first tore the connection out from under the
 * others.
 */
function connect(): Promise<Admin> {
    if (!adminConnection) {
        const kafka = new Kafka({
            clientId: CLIENT_ID,
            brokers: env.KAFKA_BROKERS.split(",").map((broker) =>
                broker.trim()
            ),
            connectionTimeout: CONNECTION_TIMEOUT_MS,
            requestTimeout: REQUEST_TIMEOUT_MS,
            retry: { retries: 5 }
        });

        const admin = kafka.admin();
        adminConnection = admin
            .connect()
            .then(() => admin)
            .catch((error: unknown) => {
                // Drop the rejected promise so the next call retries a fresh
                // connection instead of replaying this failure forever.
                adminConnection = null;
                throw error;
            });
    }

    return adminConnection;
}

/** Cluster id, controller and broker list - also serves as the health probe. */
async function getClusterInfo(): Promise<ClusterInfo> {
    const admin = await connect();
    return await admin.describeCluster();
}

async function listTopics(): Promise<string[]> {
    const admin = await connect();
    return await admin.listTopics();
}

/** Metadata for the named topics, or for every topic when none are given. */
async function getTopicMetadata(
    topics?: string[]
): Promise<{ topics: ITopicMetadata[] }> {
    const admin = await connect();
    return await admin.fetchTopicMetadata({ topics: topics ?? [] });
}

async function createTopic(topicConfig: ITopicConfig): Promise<boolean> {
    const admin = await connect();
    return await admin.createTopics({
        topics: [topicConfig],
        waitForLeaders: true
    });
}

async function deleteTopic(topic: string): Promise<void> {
    const admin = await connect();
    await admin.deleteTopics({ topics: [topic] });
}

async function getTopicConfiguration(topic: string): Promise<ConfigEntries[]> {
    const admin = await connect();
    const configs = await admin.describeConfigs({
        includeSynonyms: false,
        resources: [{ type: ConfigResourceTypes.TOPIC, name: topic }]
    });

    return configs.resources[0]?.configEntries ?? [];
}

async function listConsumerGroups(): Promise<{ groups: GroupOverview[] }> {
    const admin = await connect();
    return await admin.listGroups();
}

async function describeConsumerGroup(
    groupId: string
): Promise<GroupDescription> {
    const admin = await connect();
    const { groups } = await admin.describeGroups([groupId]);

    const group = groups[0];
    if (!group) {
        throw new Error(`Consumer group not found: ${groupId}`);
    }

    return group;
}

export {
    getClusterInfo,
    listTopics,
    getTopicMetadata,
    createTopic,
    deleteTopic,
    getTopicConfiguration,
    listConsumerGroups,
    describeConsumerGroup,
    type ClusterInfo,
    type ConfigEntries,
    type GroupDescription,
    type GroupOverview,
    type ITopicMetadata
};
