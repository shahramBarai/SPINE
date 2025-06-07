import { FastifyPluginAsync } from "../deps";
import { platformDb } from "../db/platform";

// Request params type
interface ProjectParams {
  id: string;
}

// Create project body type
interface CreateProjectBody {
  name: string;
  description?: string;
  members: Array<{
    userId: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
  }>;
}

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all projects
  fastify.get("/projects", async () => {
    const projects = await platformDb.project.findMany();
    return projects;
  });

  // Get project by id
  fastify.get<{ Params: ProjectParams }>("/projects/:id", async (request) => {
    const project = await platformDb.project.findUnique({
      where: { id: request.params.id },
    });
    return project;
  });

  // Create project
  fastify.post<{ Body: CreateProjectBody }>("/projects", async (request) => {
    const project = await platformDb.project.create({
      data: {
        name: request.body.name,
        description: request.body.description,
        members: {
          create: request.body.members,
        },
      },
    });
    return project;
  });

  // Update project
  fastify.put<{
    Params: ProjectParams;
    Body: Partial<{
      name: string;
      description: string;
    }>;
  }>("/projects/:id", async (request) => {
    const project = await platformDb.project.update({
      where: { id: request.params.id },
      data: {
        name: request.body.name,
        description: request.body.description,
      },
    });
    return project;
  });

  // Delete project
  fastify.delete<{ Params: ProjectParams }>(
    "/projects/:id",
    async (request) => {
      await platformDb.project.delete({
        where: { id: request.params.id },
      });
      return { success: true };
    }
  );
};
