import { randomBytes, createHash } from "crypto";
import { prisma } from "../../prisma/client";

const KEY_PREFIX = "spine_";
const KEY_PREFIX_DISPLAY_LENGTH = KEY_PREFIX.length + 8;

function hashKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
}

/* -------------------------------- CREATE -------------------------------- */

/**
 * Creates a new API key for a project, granting external systems
 * (authenticated with it) access scoped to that project. The raw key is
 * only ever returned here, at creation time - only its hash is persisted,
 * so losing the raw value means generating a new key, not recovering it.
 * @param entityId - The id of the project the key grants access to
 * @param createdBy - The id of the user creating the key
 * @param name - A label for the key, for the owner's own bookkeeping (e.g. "CI pipeline")
 * @returns The created key's metadata plus the one-time raw key value
 */
async function createApiKey(
    entityId: string,
    createdBy: string,
    name: string
) {
    const rawKey = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, KEY_PREFIX_DISPLAY_LENGTH);

    const apiKey = await prisma.apiKey.create({
        data: { entityId, createdBy, name, keyHash, keyPrefix },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            createdAt: true
        }
    });

    return { ...apiKey, rawKey };
}

/* -------------------------------- READ -------------------------------- */

/**
 * Lists a project's API keys, most recent first. Never includes the raw
 * key or its hash - only what's needed to tell keys apart in a management UI.
 * @param entityId - The id of the project
 * @returns An array of API key metadata
 */
async function listApiKeys(entityId: string) {
    return await prisma.apiKey.findMany({
        where: { entityId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            lastUsedAt: true,
            createdAt: true
        }
    });
}

/**
 * Verifies a raw API key presented by an external caller and, if valid,
 * records the attempt as this key's most recent use.
 * @param rawKey - The raw key value presented by the caller (e.g. from an Authorization header)
 * @returns The id of the project this key grants access to, or `null` if the key doesn't exist
 */
async function verifyApiKey(rawKey: string): Promise<{ entityId: string } | null> {
    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash: hashKey(rawKey) },
        select: { id: true, entityId: true }
    });
    if (!apiKey) {
        return null;
    }

    await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
    });

    return { entityId: apiKey.entityId };
}

/* -------------------------------- DELETE -------------------------------- */

/**
 * Revokes (deletes) a project's API key. A no-op if the key doesn't exist
 * or belongs to a different project.
 * @param entityId - The id of the project the key must belong to
 * @param keyId - The id of the key to revoke
 */
async function revokeApiKey(entityId: string, keyId: string): Promise<void> {
    await prisma.apiKey.deleteMany({ where: { id: keyId, entityId } });
}

/* ------------------------------ EXPORTS -------------------------------- */
export { createApiKey, listApiKeys, verifyApiKey, revokeApiKey };
