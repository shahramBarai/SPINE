// Core dependencies
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";

// Types
import type {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
  FastifyPluginAsync,
} from "fastify";

// Export dependencies
export {
  Fastify,
  cors,
  z,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyReply,
  type FastifyPluginAsync,
};
