import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  ProjectService,
  CreateProjectData,
  UpdateProjectData,
  AddProjectMemberData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";
import { MemberRole } from "generated/platform";

// Request params type
interface ProjectParams {
  id: string;
}

interface ProjectMemberParams {
  projectId: string;
  userId: string;
}

export const projectRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all projects
  fastify.get(
    "/projects",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const projects = await ProjectService.getAllProjects();
      reply.send(projects);
    })
  );

  // Get project by id
  fastify.get(
    "/projects/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const project = await ProjectService.getProjectById(id);
      reply.send(project);
    })
  );

  // Get projects by user id
  fastify.get(
    "/projects/user/:userId",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.params as { userId: string };
      const projects = await ProjectService.getProjectsByUserId(userId);
      reply.send(projects);
    })
  );

  // Create project
  fastify.post(
    "/projects",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreateProjectData;
      const project = await ProjectService.createProject(data);
      reply.code(201).send(project);
    })
  );

  // Update project
  fastify.put(
    "/projects/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateProjectData;
      const project = await ProjectService.updateProject(id, data);
      reply.send(project);
    })
  );

  // Delete project
  fastify.delete(
    "/projects/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await ProjectService.deleteProject(id);
      reply.code(204).send();
    })
  );

  // Get project members
  fastify.get(
    "/projects/:id/members",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const members = await ProjectService.getProjectMembers(id);
      reply.send(members);
    })
  );

  // Add project member
  fastify.post(
    "/projects/:id/members",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as AddProjectMemberData;
      const member = await ProjectService.addProjectMember(id, data);
      reply.code(201).send(member);
    })
  );

  // Update project member role
  fastify.put(
    "/projects/:projectId/members/:userId",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, userId } = request.params as {
        projectId: string;
        userId: string;
      };
      const { role } = request.body as { role: MemberRole };
      const member = await ProjectService.updateProjectMemberRole(
        projectId,
        userId,
        role
      );
      reply.send(member);
    })
  );

  // Remove project member
  fastify.delete(
    "/projects/:projectId/members/:userId",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, userId } = request.params as {
        projectId: string;
        userId: string;
      };
      await ProjectService.removeProjectMember(projectId, userId);
      reply.code(204).send();
    })
  );
};
