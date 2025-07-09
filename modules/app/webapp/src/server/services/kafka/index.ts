import { Kafka, Admin, ITopicConfig, ConfigResourceTypes } from 'kafkajs';

interface KafkaConfig {
  clientId: string;
  brokers: string[];
  connectionTimeout: number;
  requestTimeout: number;
  retry: {
    retries: number;
  };
}

export class KafkaAdminService {
  private kafka: Kafka;
  private admin: Admin;
  private config: KafkaConfig;

  constructor(config?: Partial<KafkaConfig>) {
    this.config = {
      clientId: config?.clientId || 'webapp-kafka-client',
      brokers: config?.brokers || (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      connectionTimeout: config?.connectionTimeout || 10000,
      requestTimeout: config?.requestTimeout || 30000,
      retry: {
        retries: config?.retry?.retries || 5,
      },
    };

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
      connectionTimeout: this.config.connectionTimeout,
      requestTimeout: this.config.requestTimeout,
      retry: {
        retries: this.config.retry.retries,
      },
    });
    this.admin = this.kafka.admin();
  }

  async connect(): Promise<void> {
    try {
      await this.admin.connect();
      console.info('Kafka admin client connected successfully');
    } catch (error) {
      console.error('Failed to connect to Kafka admin client', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.admin.disconnect();
      console.info('Kafka admin client disconnected');
    } catch (error) {
      console.error('Failed to disconnect Kafka admin client', error);
      throw error;
    }
  }

  async listTopics(): Promise<string[]> {
    try {
      const topics = await this.admin.listTopics();
      return topics;
    } catch (error) {
      console.error('Failed to list topics', error);
      throw error;
    }
  }

  async getTopicMetadata(topics?: string[]): Promise<any> {
    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: topics || [] });
      return metadata;
    } catch (error) {
      console.error('Failed to fetch topic metadata', error);
      throw error;
    }
  }

  async createTopic(topicConfig: ITopicConfig): Promise<boolean> {
    try {
      const result = await this.admin.createTopics({
        topics: [topicConfig],
        waitForLeaders: true,
      });
      return result;
    } catch (error) {
      console.error('Failed to create topic', error);
      throw error;
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    try {
      await this.admin.deleteTopics({
        topics: [topicName],
      });
      console.info(`Topic ${topicName} deleted successfully`);
    } catch (error) {
      console.error(`Failed to delete topic ${topicName}`, error);
      throw error;
    }
  }

  async getTopicConfiguration(topicName: string): Promise<any> {
    try {
      const configs = await this.admin.describeConfigs({
        includeSynonyms: false,
        resources: [
          {
            type: ConfigResourceTypes.TOPIC,
            name: topicName,
          },
        ],
      });
      return configs.resources[0]?.configEntries || [];
    } catch (error) {
      console.error(`Failed to get configuration for topic ${topicName}`, error);
      throw error;
    }
  }

  async getClusterInfo(): Promise<any> {
    try {
      const cluster = await this.admin.describeCluster();
      return cluster;
    } catch (error) {
      console.error('Failed to get cluster info', error);
      throw error;
    }
  }

  async getConsumerGroups(): Promise<any> {
    try {
      const groups = await this.admin.listGroups();
      return groups;
    } catch (error) {
      console.error('Failed to list consumer groups', error);
      throw error;
    }
  }

  async getConsumerGroupDetails(groupId: string): Promise<any> {
    try {
      const groupDetails = await this.admin.describeGroups([groupId]);
      return groupDetails.groups[0];
    } catch (error) {
      console.error(`Failed to get consumer group details for ${groupId}`, error);
      throw error;
    }
  }
}

// Singleton instance for the webapp
let kafkaAdminInstance: KafkaAdminService | null = null;

export function getKafkaAdminService(): KafkaAdminService {
  if (!kafkaAdminInstance) {
    kafkaAdminInstance = new KafkaAdminService();
  }
  return kafkaAdminInstance;
}

export async function initializeKafkaAdmin(): Promise<void> {
  const service = getKafkaAdminService();
  await service.connect();
}

export async function closeKafkaAdmin(): Promise<void> {
  if (kafkaAdminInstance) {
    await kafkaAdminInstance.disconnect();
    kafkaAdminInstance = null;
  }
}