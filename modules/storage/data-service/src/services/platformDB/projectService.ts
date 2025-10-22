import { platformDb } from "../../db/platform";
import { EntityType, MemberRole } from "generated/platform";
import {
  EntityNotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError,
  ServiceError,
} from "../../utils/errors";

export interface CreateProjectData {
  name: string;
  description?: string;
  members?: AddProjectMemberData[];
  type: EntityType;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
}

export interface AddProjectMemberData {
  userId: string;
  role: MemberRole;
}

export class ProjectService {
  // Get all projects
  static async getAllProjects() {
    try {
      return platformDb.entity.findMany({
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          pipelines: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getAllProjects", error);
    }
  }

  // Get project by id
  static async getProjectById(id: string) {
    try {
      const project = await platformDb.entity.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          pipelines: true,
        },
      });

      if (!project) {
        throw EntityNotFoundError("Project", id);
      }

      return project;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getProjectById", error);
    }
  }

  // Get projects for a specific user
  static async getProjectsByUserId(userId: string) {
    try {
      return await platformDb.entity.findMany({
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          pipelines: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getProjectsByUserId", error);
    }
  }

  // Create new project
  static async createProject(data: CreateProjectData) {
    // Validate that all member users exist if members are provided
    if (data.members && data.members.length > 0) {
      for (const member of data.members) {
        try {
          const user = await platformDb.user.findUnique({
            where: { id: member.userId },
          });
          if (!user) {
            throw EntityNotFoundError("User", member.userId);
          }
        } catch (error: any) {
          if (error.name === "ServiceError") {
            throw error;
          }
          throw EntityNotFoundError("User", member.userId);
        }
      }
    }

    try {
      return await platformDb.entity.create({
        data: {
          name: data.name,
          description: data.description,
          type: data.type,
          members: data.members
            ? {
                create: data.members,
              }
            : undefined,
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("createProject", error);
    }
  }

  // Update project
  static async updateProject(id: string, data: UpdateProjectData) {
    // Check if project exists
    await this.getProjectById(id);

    try {
      return await platformDb.entity.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("updateProject", error);
    }
  }

  // Delete project
  static async deleteProject(id: string) {
    // Check if project exists
    await this.getProjectById(id);

    try {
      return await platformDb.entity.delete({
        where: { id },
      });
    } catch (error: any) {
      throw DatabaseError("deleteProject", error);
    }
  }

  // Get project members
  static async getProjectMembers(entityId: string) {
    // Check if project exists
    await this.getProjectById(entityId);

    try {
      return await platformDb.entityMember.findMany({
        where: { entityId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("getProjectMembers", error);
    }
  }

  // Add member to project
  static async addProjectMember(entityId: string, data: AddProjectMemberData) {
    // Check if project exists
    await this.getProjectById(entityId);

    // Check if user exists
    try {
      const user = await platformDb.user.findUnique({
        where: { id: data.userId },
      });
      if (!user) {
        throw EntityNotFoundError("User", data.userId);
      }
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getUserForProjectMember", error);
    }

    // Check if user is already a member of the project
    const isAlreadyMember = await this.isProjectMember(entityId, data.userId);
    if (isAlreadyMember) {
      throw ConflictError(
        "addProjectMember",
        "User is already a member of the project"
      );
    }

    try {
      return await platformDb.entityMember.create({
        data: {
          entityId,
          userId: data.userId,
          role: data.role,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("addProjectMember", error);
    }
  }

  // Update project member role
  static async updateProjectMemberRole(
    entityId: string,
    userId: string,
    role: MemberRole
  ) {
    // Check if project exists
    await this.getProjectById(entityId);

    // Check if user is a member of the project
    const isMember = await this.isProjectMember(entityId, userId);
    if (!isMember) {
      throw new ServiceError(
        "NOT_FOUND",
        `User with ID ${userId} is not a member of project ${entityId}`,
        { userId, entityId }
      );
    }

    try {
      return await platformDb.entityMember.update({
        where: {
          entityId_userId: {
            entityId,
            userId,
          },
        },
        data: {
          role,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("updateProjectMemberRole", error);
    }
  }

  // Remove member from project
  static async removeProjectMember(entityId: string, userId: string) {
    // Check if project exists
    await this.getProjectById(entityId);

    // Check if user is a member of the project
    const isMember = await this.isProjectMember(entityId, userId);
    if (!isMember) {
      throw new ServiceError(
        "NOT_FOUND",
        `User with ID ${userId} is not a member of project ${entityId}`,
        { userId, entityId }
      );
    }

    try {
      return await platformDb.entityMember.delete({
        where: {
          entityId_userId: {
            entityId,
            userId,
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("removeProjectMember", error);
    }
  }

  // Check if user is project member
  static async isProjectMember(entityId: string, userId: string) {
    try {
      const member = await platformDb.entityMember.findUnique({
        where: {
          entityId_userId: {
            entityId,
            userId,
          },
        },
      });
      return !!member;
    } catch (error: any) {
      throw DatabaseError("isProjectMember", error);
    }
  }

  // Get user's role in project
  static async getUserRoleInProject(entityId: string, userId: string) {
    try {
      const member = await platformDb.entityMember.findUnique({
        where: {
          entityId_userId: {
            entityId,
            userId,
          },
        },
        select: {
          role: true,
        },
      });
      return member?.role || null;
    } catch (error: any) {
      throw DatabaseError("getUserRoleInProject", error);
    }
  }
}
