import { getPrisma } from "../../prisma/client";
import { UserRole } from "../../generated/client";

const prisma = getPrisma();

/* -------------------------------- CREATE -------------------------------- */
/**
 * Create a new user
 * @param data - The data for the user
 * @param data.name - The name of the user
 * @param data.email - The email of the user
 * @param data.password - The password of the user
 * @param data.role - The role of the user (optional, defaults to 'USER')
 * @throws {Error} If the user already exists
 * @returns The created user
 */
async function createUser(data: { name?: string; email: string; password: string; role?: UserRole }) {
  const existingUser = await getUserByEmail(data.email);
  if (existingUser) {
    throw new Error("User with this email already exists");
  }
  const user = await prisma.user.create({
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
  return user;
}

/* -------------------------------- READ -------------------------------- */

/**
 * Get all users
 * @returns An array of users
 */
async function getAllUsers() {
  const users = await prisma.user.findMany({
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
}

/**
 * Get user by id
 * @param id - The id of the user
 * @returns The user or null if not found
 */
async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
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
}


/**
 * Get user by email
 * @param email - The email of the user
 * @returns The user or `null` if not found
 */
async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
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
  return user;
}

/**
 * Get user by email with password (for authentication)
 * @param email - The email of the user
 * @returns The user or `null` if not found
 */
async function getUserByEmailWithPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
    },
  });
  return user;
}


/* -------------------------------- UPDATE -------------------------------- */

/**
 * Update a user
 * @param id - The id of the user
 * @param data - The data for the user
 * @param data.name - The name of the user (optional)
 * @param data.email - The email of the user (optional)
 * @param data.password - The password of the user (optional)
 * @param data.role - The role of the user (optional)
 * @throws {Error} If the user does not exist
 * @throws {Error} If the email is already taken
 * @returns The updated user
 */
async function updateUser(id: string, data: { name?: string; email?: string; password?: string; role?: UserRole }) {
  // Check if user exists
  const user = await getUserById(id);
  if (!user) {
    throw new Error("User not found");
  }

  // If email is being changed, check if new email is already taken
  if (data.email) {
    const existingUser = await getUserByEmail(data.email);
    if (existingUser && existingUser.id !== id) {
      throw new Error("Email already taken by another user");
    }
  }

  return await prisma.user.update({
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
}

/* -------------------------------- DELETE -------------------------------- */

/**
 * Delete a user
 * @param id - The id of the user
 * @throws {Error} If the user does not exist
 * @returns The id of the deleted user
 */
async function deleteUser(id: string) {
  const user = await getUserById(id);
  if (!user) {
    return id;
  }
  const deletedUser = await prisma.user.delete({
    where: { id }
  });
  return deletedUser.id;
}


/* ------------------------------ EXPORTS -------------------------------- */
export {
  createUser,
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUserByEmailWithPassword,
  updateUser,
  deleteUser,
}