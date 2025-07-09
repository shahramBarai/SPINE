import { Kafka, Admin, ITopicConfig, ConfigResourceTypes } from 'kafkajs';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export class KafkaAdminService {
  private kafka: Kafka;
  private admin: Admin;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      connectionTimeout: config.kafka.connectionTimeout,
      requestTimeout: config.kafka.requestTimeout,
      retry: {
        retries: config.kafka.retry.retries,
      },
    });
    this.admin = this.kafka.admin();
  }

  async connect(): Promise<void> {
    try {
      await this.admin.connect();
      logger.info('Kafka admin client connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Kafka admin client', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.admin.disconnect();
      logger.info('Kafka admin client disconnected');
    } catch (error) {
      logger.error('Failed to disconnect Kafka admin client', error);
      throw error;
    }
  }

  async listTopics(): Promise<string[]> {
    try {
      const topics = await this.admin.listTopics();
      return topics;
    } catch (error) {
      logger.error('Failed to list topics', error);
      throw error;
    }
  }

  async getTopicMetadata(topics?: string[]): Promise<any> {
    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: topics || [] });
      return metadata;
    } catch (error) {
      logger.error('Failed to fetch topic metadata', error);
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
      logger.error('Failed to create topic', error);
      throw error;
    }
  }

  async deleteTopic(topicName: string): Promise<void> {
    try {
      await this.admin.deleteTopics({
        topics: [topicName],
      });
      logger.info(`Topic ${topicName} deleted successfully`);
    } catch (error) {
      logger.error(`Failed to delete topic ${topicName}`, error);
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
      logger.error(`Failed to get configuration for topic ${topicName}`, error);
      throw error;
    }
  }

  async getClusterInfo(): Promise<any> {
    try {
      const cluster = await this.admin.describeCluster();
      return cluster;
    } catch (error) {
      logger.error('Failed to get cluster info', error);
      throw error;
    }
  }

  async getConsumerGroups(): Promise<any> {
    try {
      const groups = await this.admin.listGroups();
      return groups;
    } catch (error) {
      logger.error('Failed to list consumer groups', error);
      throw error;
    }
  }

  async getConsumerGroupDetails(groupId: string): Promise<any> {
    try {
      const groupDetails = await this.admin.describeGroups([groupId]);
      return groupDetails.groups[0];
    } catch (error) {
      logger.error(`Failed to get consumer group details for ${groupId}`, error);
      throw error;
    }
  }
}