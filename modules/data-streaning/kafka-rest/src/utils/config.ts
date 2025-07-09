import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  port: z.string().default('3002').transform(Number),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('production'),
  kafka: z.object({
    brokers: z.string().transform((val) => val.split(',')),
    clientId: z.string().default('kafka-rest-service'),
    connectionTimeout: z.string().default('10000').transform(Number),
    requestTimeout: z.string().default('30000').transform(Number),
    retry: z.object({
      retries: z.string().default('5').transform(Number),
    }),
  }),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  cors: z.object({
    origin: z.string().default('http://localhost:3000'),
  }),
});

const env = {
  port: process.env.PORT,
  host: process.env.HOST,
  nodeEnv: process.env.NODE_ENV as any,
  kafka: {
    brokers: process.env.KAFKA_BROKERS || 'localhost:9092',
    clientId: process.env.KAFKA_CLIENT_ID,
    connectionTimeout: process.env.KAFKA_CONNECTION_TIMEOUT,
    requestTimeout: process.env.KAFKA_REQUEST_TIMEOUT,
    retry: {
      retries: process.env.KAFKA_RETRY_RETRIES,
    },
  },
  logLevel: process.env.LOG_LEVEL as any,
  cors: {
    origin: process.env.CORS_ORIGIN,
  },
};

export const config = configSchema.parse(env);