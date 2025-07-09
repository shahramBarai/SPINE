import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { healthRoutes } from './routes/health';
import { topicsRoutes } from './routes/topics';
import { clusterRoutes } from './routes/cluster';

const buildServer = async () => {
  const fastify = Fastify({
    logger: logger as any,
  });

  // Register plugins
  await fastify.register(sensible);
  
  await fastify.register(cors, {
    origin: config.cors.origin,
    credentials: true,
  });

  await fastify.register(helmet);

  // Register Swagger
  const swaggerHost = config.nodeEnv === 'development' ? `localhost:${config.port}` : `${config.host}:${config.port}`;
  
  await fastify.register(swagger, {
    swagger: {
      info: {
        title: 'Kafka REST API',
        description: 'REST API for managing Kafka topics and cluster',
        version: '1.0.0',
      },
      host: swaggerHost,
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Topics', description: 'Kafka topic management' },
        { name: 'Cluster', description: 'Kafka cluster information' },
        { name: 'Consumer Groups', description: 'Consumer group management' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  await fastify.register(topicsRoutes, { prefix: '/api/v1' });
  await fastify.register(clusterRoutes, { prefix: '/api/v1' });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, req: request }, 'Request error');
    
    const statusCode = error.statusCode || 500;
    const response = {
      error: {
        message: error.message || 'Internal Server Error',
        statusCode,
      },
    };

    reply.status(statusCode).send(response);
  });

  return fastify;
};

const start = async () => {
  try {
    const server = await buildServer();
    
    await server.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(`Kafka REST API server listening on ${config.host}:${config.port}`);
    logger.info(`Swagger documentation available at http://${config.host}:${config.port}/docs`);
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing server');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing server');
  process.exit(0);
});

// Start the server
start();