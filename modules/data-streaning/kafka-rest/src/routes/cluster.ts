import { FastifyPluginAsync } from 'fastify';
import { KafkaAdminService } from '../services/kafkaAdmin';
import { logger } from '../utils/logger';

export const clusterRoutes: FastifyPluginAsync = async (fastify) => {
  const kafkaAdmin = new KafkaAdminService();
  
  // Connect to Kafka admin on startup
  await kafkaAdmin.connect();
  
  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await kafkaAdmin.disconnect();
  });

  // Get cluster information
  fastify.get('/cluster', {
    schema: {
      description: 'Get Kafka cluster information',
      tags: ['Cluster'],
      response: {
        200: {
          type: 'object',
          properties: {
            clusterId: { type: 'string' },
            controller: { type: 'object' },
            brokers: { type: 'array' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    try {
      const clusterInfo = await kafkaAdmin.getClusterInfo();
      return clusterInfo;
    } catch (error) {
      logger.error('Error fetching cluster info:', error);
      throw fastify.httpErrors.internalServerError('Failed to fetch cluster information');
    }
  });

  // List consumer groups
  fastify.get('/consumer-groups', {
    schema: {
      description: 'List all consumer groups',
      tags: ['Consumer Groups'],
      response: {
        200: {
          type: 'object',
          properties: {
            groups: { type: 'array' },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    try {
      const groups = await kafkaAdmin.getConsumerGroups();
      return groups;
    } catch (error) {
      logger.error('Error listing consumer groups:', error);
      throw fastify.httpErrors.internalServerError('Failed to list consumer groups');
    }
  });

  // Get consumer group details
  fastify.get('/consumer-groups/:groupId', {
    schema: {
      description: 'Get details for a specific consumer group',
      tags: ['Consumer Groups'],
      params: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
        },
        required: ['groupId'],
      },
      response: {
        200: {
          type: 'object',
        },
      },
    },
  }, async (request, _reply) => {
    try {
      const { groupId } = request.params as any;
      const groupDetails = await kafkaAdmin.getConsumerGroupDetails(groupId);
      return groupDetails;
    } catch (error) {
      logger.error('Error fetching consumer group details:', error);
      throw fastify.httpErrors.internalServerError('Failed to fetch consumer group details');
    }
  });
};