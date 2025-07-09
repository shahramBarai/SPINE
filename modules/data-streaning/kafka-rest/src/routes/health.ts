import { FastifyPluginAsync } from 'fastify';
import { KafkaAdminService } from '../services/kafkaAdmin';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            kafka: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                brokers: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  }, async (_request, _reply) => {
    const kafkaAdmin = new KafkaAdminService();
    let kafkaConnected = false;
    let brokers: any[] = [];

    try {
      await kafkaAdmin.connect();
      const clusterInfo = await kafkaAdmin.getClusterInfo();
      brokers = clusterInfo.brokers;
      kafkaConnected = true;
      await kafkaAdmin.disconnect();
    } catch (error) {
      // Kafka connection failed, but service is still running
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      kafka: {
        connected: kafkaConnected,
        brokers: brokers.map((broker: any) => `${broker.host}:${broker.port}`),
      },
    };
  });
};