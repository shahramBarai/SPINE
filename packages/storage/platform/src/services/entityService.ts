import { getPrisma } from "../../prisma/client";
import { EntityType, MemberRole } from "../../generated/client";
import { getAllUsers } from "./userService";

const prisma = getPrisma();

/* -------------------------------- CREATE -------------------------------- */

/**
 * Create a new entity
 * @param data - The data for the entity
 * @param data.name - The name of the entity
 * @param data.type - The type of the entity
 * @param data.description - The description of the entity (optional)
 * @param data.members - The members of the entity (optional)
 * @throws {Error} If the members are provided and one of the users is not found
 * @returns The created entity information
 */
async function createEntity(data: {
  name: string;
  type: EntityType;
  description?: string;
  members?: { userId: string; role: MemberRole }[];
}) {
  // Validate that all member users exist if members are provided
  if (data.members && data.members.length > 0) {
    for (const member of data.members) {
      const user = await prisma.user.findUnique({
        where: { id: member.userId },
      });
      if (!user) {
        throw new Error(`User with ID ${member.userId} not found`);
      }
    }
  }

  const entity = await prisma.entity.create({
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
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return entity;
}

/**
 * Add members to an entity
 * @param entityId - The id of the entity
 * @param newMembers - List of new members to add
 * @param newMembers[i].userId - The id of the user to add
 * @param newMembers[i].role - The role of the user to add
 * @throws {Error} If one or more users do not exist
 * @throws {Error} If the entity does not exist or the users do not exist
 * @returns The new members that were added
 */
async function addMembers(entityId: string, newMembers: { userId: string; role: MemberRole }[]) {
  // Check if users exist
  const allUsersExist = await getAllUsers();
  const unfoundUsers = newMembers.filter(member => !allUsersExist.some(user => user.id === member.userId));
  if (unfoundUsers.length > 0) {
    throw new Error(`Users with IDs ${unfoundUsers.map(user => user.userId).join(', ')} not found`);
  }

  // Filtering out existing members 
  const existingMembers = await getMembers(entityId); // also throw Error if entity does not exist
  const newMembersToAdd = newMembers.filter(
    newMember => !existingMembers.some(member => member.userId === newMember.userId)
  );

  // Creating new members
  const newEntityMembers = await prisma.entityMember.createManyAndReturn({
    data: newMembersToAdd.map(member => ({
      entityId,
      userId: member.userId,
      role: member.role,
    })),
  });

  // Returning new members
  return newEntityMembers;
}

/* -------------------------------- READ -------------------------------- */

/**
 * Get all entities
 * @returns An array of entities
 */
async function getAllEntities() {
  const entities = await prisma.entity.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return entities;
}

/**
 * Get entity by id
 * @param id - The id of the entity
 * @returns The entity or `null` if not found
 */
async function getEntityById(id: string) {
  const entity = await prisma.entity.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return entity;
}

/**
 * Get entities for a specific user
 * @param userId - The id of the user
 * @returns An array of entities where the user is a member
 */
async function getEntitiesByUserId(userId: string) {
  const entities = await prisma.entity.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return entities;
}

/**
 * Get members of an entity
 * @param entityId - The id of the entity
 * @throws {Error} If the entity does not exist
 * @returns An array of entity members
 */
async function getMembers(entityId: string) {
  // Check if entity exists
  const entity = await getEntityById(entityId);
  if (!entity) {
    throw new Error(`Entity with ID ${entityId} not found`);
  }
  const members = await prisma.entityMember.findMany({
    where: { entityId },
  });
  return members;
}

/**
 * Get a member of an entity
 * @param entityId - The id of the entity
 * @param userId - The id of the user
 * @returns The member or `null` if not found
 */
async function getMember(entityId: string, userId: string) {
  const member = await prisma.entityMember.findUnique({
    where: { entityId_userId: { entityId, userId } },
  });
  return member;
}

/* -------------------------------- UPDATE -------------------------------- */

/**
 * Update an entity
 * @param id - The id of the entity
 * @param data - The data for the entity
 * @param data.name - The name of the entity
 * @param data.description - The description of the entity
 * @throws {Error} If the entity does not exist
 * @returns The updated entity information
 */
async function updateEntity(id: string, data: {
  name?: string;
  description?: string;
}) {
  // Check if project exists
  const entity = await getEntityById(id);
  if (!entity) {
    throw new Error(`Entity with ID ${id} not found`);
  }
  return await prisma.entity.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update member role
 * @param entityId - The id of the entity
 * @param userId - The id of the user
 * @param role - The role of the user
 * @throws {Error} If the user is not a member of the entity
 * @returns The updated entity member information
 */
async function updateMemberRole(entityId: string, userId: string, role: MemberRole) {
  // Check if user is a member of the entity
  const member = await getMember(entityId, userId);
  if (!member) {
    throw new Error(`User with ID ${userId} is not a member of entity ${entityId}`);
  }

  return await prisma.entityMember.update({
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
  });
}

/* -------------------------------- DELETE -------------------------------- */

/**
 * Delete an entity
 * @param id - The id of the entity
 * @returns The id of the deleted entity
 */
async function deleteEntity(id: string) {
  // Check if project exists
  const entity = await getEntityById(id);
  if (!entity) {
    return id;
  }
  const deletedEntity = await prisma.entity.delete({
    where: { id },
  });
  return deletedEntity.id;
}

/**
 * Remove member from an entity
 * @param entityId - The id of the entity
 * @param userId - The id of the user
 * @throws {Error} If the entity does not exist or the user is not a member of the entity
 */
async function removeMember(entityId: string, userId: string) {
  // Check if entity exists
  const entity = await getEntityById(entityId);
  if (!entity) {
    throw new Error(`Entity with ID ${entityId} not found`);
  }

  // Check if user is a member of the entity
  const member = await getMember(entityId, userId);
  if (!member) {
    return;
  }

  await prisma.entityMember.delete({
    where: {
      entityId_userId: {
        entityId,
        userId,
      },
    },
  });
}

/* ------------------------------ EXPORTS -------------------------------- */
export {
  createEntity,
  addMembers,
  getAllEntities,
  getEntityById,
  getEntitiesByUserId,
  getMembers,
  getMember,
  updateEntity,
  updateMemberRole,
  deleteEntity,
  removeMember,
}