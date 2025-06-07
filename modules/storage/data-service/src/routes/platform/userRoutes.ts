import {
  FastifyPluginAsync,
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  UserService,
  CreateUserData,
  UpdateUserData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";

interface UserParams {
  id: string;
  email: string;
}

export const userRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all users
  fastify.get(
    "/users",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const users = await UserService.getAllUsers();
      reply.send(users);
    })
  );

  // Get user by id
  fastify.get(
    "/user/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = await UserService.getUserById(id);
      reply.send(user);
    })
  );

  // Get user by email
  fastify.get(
    "/user/email/:email",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.params as { email: string };
      const user = await UserService.getUserByEmail(email);
      reply.send(user);
    })
  );

  // Get user by email with password (for authentication)
  fastify.get(
    "/user/auth/:email",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.params as { email: string };
      const user = await UserService.getUserByEmailWithPassword(email);
      reply.send(user);
    })
  );

  // Create user
  fastify.post(
    "/users",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreateUserData;
      const user = await UserService.createUser(data);
      reply.code(201).send(user);
    })
  );

  // Update user
  fastify.put(
    "/users/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateUserData;
      const user = await UserService.updateUser(id, data);
      reply.send(user);
    })
  );

  // Delete user
  fastify.delete(
    "/users/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await UserService.deleteUser(id);
      reply.code(204).send();
    })
  );

  // Get user's project memberships
  fastify.get(
    "/users/:id/projects",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const memberships = await UserService.getUserProjectMemberships(id);
      reply.send(memberships);
    })
  );
};
