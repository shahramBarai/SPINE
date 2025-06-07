import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  PipelineService,
  CreatePipelineData,
  UpdatePipelineData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";

interface PipelineParams {
  id: string;
}

interface ProjectParams {
  projectId: string;
}

interface UserParams {
  userId: string;
}

export const pipelineRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all pipelines
  fastify.get(
    "/pipelines",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const pipelines = await PipelineService.getAllPipelines();
      reply.send(pipelines);
    })
  );

  // Get pipeline by id
  fastify.get(
    "/pipelines/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const pipeline = await PipelineService.getPipelineById(id);
      reply.send(pipeline);
    })
  );

  // Get pipelines by project
  fastify.get(
    "/pipelines/project/:projectId",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const pipelines = await PipelineService.getPipelinesByProject(projectId);
      reply.send(pipelines);
    })
  );

  // Get active pipelines
  fastify.get(
    "/pipelines/active",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const pipelines = await PipelineService.getActivePipelines();
      reply.send(pipelines);
    })
  );

  // Create pipeline
  fastify.post(
    "/pipelines",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreatePipelineData;
      const pipeline = await PipelineService.createPipeline(data);
      reply.code(201).send(pipeline);
    })
  );

  // Update pipeline
  fastify.put(
    "/pipelines/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdatePipelineData;
      const pipeline = await PipelineService.updatePipeline(id, data);
      reply.send(pipeline);
    })
  );

  // Delete pipeline
  fastify.delete(
    "/pipelines/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await PipelineService.deletePipeline(id);
      reply.code(204).send();
    })
  );

  // Activate pipeline
  fastify.post(
    "/pipelines/:id/activate",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const pipeline = await PipelineService.activatePipeline(id, userId);
      reply.send(pipeline);
    })
  );

  // Deactivate pipeline
  fastify.post(
    "/pipelines/:id/deactivate",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };
      const pipeline = await PipelineService.deactivatePipeline(id, userId);
      reply.send(pipeline);
    })
  );

  // Increment pipeline version
  fastify.post(
    "/pipelines/:id/version",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const pipeline = await PipelineService.incrementPipelineVersion(id);
      reply.send(pipeline);
    })
  );
};
