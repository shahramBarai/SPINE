import { FastifyPluginAsync } from "../deps";
import { platformDb } from "../db/platform";
import { UserRole } from "generated/platform";

interface UserParams {
  id: string;
}

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all users
  fastify.get("/users", async () => {
    const users = await platformDb.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  });

  // Get user by id
  fastify.get<{ Params: UserParams }>("/users/:id", async (request) => {
    const user = await platformDb.user.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  });

  // Create user
  fastify.post<{
    Body: {
      name: string;
      email: string;
      hashedPassword: string;
      role: UserRole;
    };
  }>("/users", async (request) => {
    const user = await platformDb.user.create({
      data: {
        name: request.body.name,
        email: request.body.email,
        role: request.body.role,
        password: request.body.hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  });

  // Update user
  fastify.put<{
    Params: UserParams;
    Body: { name: string; email: string; role: UserRole };
  }>("/users/:id", async (request) => {
    const user = await platformDb.user.update({
      where: { id: request.params.id },
      data: {
        name: request.body.name,
        email: request.body.email,
        role: request.body.role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  });

  // Delete user
  fastify.delete<{ Params: UserParams }>("/users/:id", async (request) => {
    await platformDb.user.delete({
      where: { id: request.params.id },
    });
    return { success: true };
  });
};
