import { platformDb } from "../../db/platform";
import { UserRole } from "generated/platform";
import {
  EntityNotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError,
} from "../../utils/errors";

export interface CreateUserData {
  name?: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
}

export class UserService {
  // Get all users
  static async getAllUsers() {
    try {
      return await platformDb.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getAllUsers", error);
    }
  }

  // Get user by id
  static async getUserById(id: string) {
    if (!id) {
      throw ValidationError("id", "User ID is required");
    }

    try {
      const user = await platformDb.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          projectMemberships: {
            include: {
              project: true,
            },
          },
        },
      });

      if (!user) {
        throw EntityNotFoundError("User", id);
      }

      return user;
    } catch (error: any) {
      // Re-throw ServiceError instances as-is
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getUserById", error);
    }
  }

  // Get user by email
  static async getUserByEmail(email: string) {
    if (!email) {
      throw ValidationError("email", "Email is required");
    }

    try {
      const user = await platformDb.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw EntityNotFoundError("User", email);
      }

      return user;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getUserByEmail", error);
    }
  }

  // Get user by email with password (for authentication)
  static async getUserByEmailWithPassword(email: string) {
    if (!email) {
      throw ValidationError("email", "Email is required");
    }

    try {
      const user = await platformDb.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
        },
      });

      if (!user) {
        throw EntityNotFoundError("User", email);
      }

      return user;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getUserByEmailWithPassword", error);
    }
  }

  // Create user
  static async createUser(data: CreateUserData) {
    if (!data.email) {
      throw ValidationError("email", "Email is required");
    }
    if (!data.password) {
      throw ValidationError("password", "Password is required");
    }

    // Check if user already exists
    const existingUser = await this.userExists(data.email);
    if (existingUser) {
      throw ConflictError("User", "User with this email already exists");
    }

    try {
      return await platformDb.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role || UserRole.USER,
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
    } catch (error: any) {
      throw DatabaseError("createUser", error);
    }
  }

  // Update user
  static async updateUser(id: string, data: UpdateUserData) {
    if (!id) {
      throw ValidationError("id", "User ID is required");
    }

    // Check if user exists
    await this.getUserById(id); // This will throw EntityNotFoundError if not found

    // If email is being changed, check if new email is already taken
    if (data.email) {
      const existingUser = await this.getUserByEmailSafe(data.email);
      if (existingUser && existingUser.id !== id) {
        throw ConflictError("User", "Email already taken by another user");
      }
    }

    try {
      return await platformDb.user.update({
        where: { id },
        data: {
          ...data,
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
    } catch (error: any) {
      throw DatabaseError("updateUser", error);
    }
  }

  // Delete user
  static async deleteUser(id: string) {
    if (!id) {
      throw ValidationError("id", "User ID is required");
    }

    // Check if user exists
    await this.getUserById(id); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.user.delete({
        where: { id },
      });
    } catch (error: any) {
      throw DatabaseError("deleteUser", error);
    }
  }

  // Check if user exists (returns boolean)
  static async userExists(email: string): Promise<boolean> {
    if (!email) {
      return false;
    }

    try {
      const user = await platformDb.user.findUnique({
        where: { email },
        select: { id: true },
      });
      return !!user;
    } catch (error: any) {
      throw DatabaseError("userExists", error);
    }
  }

  // Get user by email safely (returns null if not found, no error)
  static async getUserByEmailSafe(email: string) {
    if (!email) {
      return null;
    }

    try {
      return await platformDb.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getUserByEmailSafe", error);
    }
  }

  // Get user's project memberships
  static async getUserProjectMemberships(userId: string) {
    if (!userId) {
      throw ValidationError("userId", "User ID is required");
    }

    // Check if user exists
    await this.getUserById(userId); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.projectMember.findMany({
        where: { userId },
        include: {
          project: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getUserProjectMemberships", error);
    }
  }
}
