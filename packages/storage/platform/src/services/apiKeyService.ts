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
 *
 * A key starts with no access at all: pass `canReadGraph` to allow graph
 * reads, and grant files individually with addFileGrant.
 * @param entityId - The id of the project the key grants access to
 * @param name - A label for the key, for the owner's own bookkeeping (e.g. "CI pipeline")
 * @param access - Optional graph permission and expiry; both default to "no access"/"never expires"
 * @returns The created key's metadata plus the one-time raw key value
 */
async function createApiKey(
    entityId: string,
    name: string,
    access?: { canReadGraph?: boolean; expiresAt?: Date | null }
) {
    const rawKey = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, KEY_PREFIX_DISPLAY_LENGTH);

    const apiKey = await prisma.apiKey.create({
        data: {
            entityId,
            name,
            keyHash,
            keyPrefix,
            canReadGraph: access?.canReadGraph ?? false,
            expiresAt: access?.expiresAt ?? null
        },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            canReadGraph: true,
            expiresAt: true,
            createdAt: true
        }
    });

    return { ...apiKey, rawKey };
}

/* -------------------------------- READ -------------------------------- */

/**
 * Lists a project's API keys, most recent first. Never includes the raw
 * key or its hash - only what's needed to tell keys apart in a management
 * UI, plus a count of how many files each one may read.
 * @param entityId - The id of the project
 * @returns An array of API key metadata
 */
async function listApiKeys(entityId: string) {
    const keys = await prisma.apiKey.findMany({
        where: { entityId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            name: true,
            keyPrefix: true,
            canReadGraph: true,
            expiresAt: true,
            lastUsedAt: true,
            createdAt: true,
            _count: { select: { fileGrants: true } }
        }
    });

    return keys.map(({ _count, ...key }) => ({
        ...key,
        fileGrantCount: _count.fileGrants
    }));
}

interface VerifiedApiKey {
    id: string;
    entityId: string;
    canReadGraph: boolean;
    fileIds: Set<string>;
}

/**
 * Verifies a raw API key presented by an external caller and, if valid,
 * resolves what it may actually access. `lastUsedAt` records successful
 * verifications only, so it never advances for a rejected key.
 *
 * `fileIds` is the key's full allow-list; an empty set means the key can't
 * read any file. Callers should treat a `null` return and an unlisted file
 * the same way (deny) rather than distinguishing them to the caller, which
 * would leak whether a given key or file exists.
 * @param rawKey - The raw key value presented by the caller (e.g. from an Authorization header)
 * @returns What the key grants access to, or `null` if it doesn't exist or has expired
 */
async function verifyApiKey(rawKey: string): Promise<VerifiedApiKey | null> {
    const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash: hashKey(rawKey) },
        select: {
            id: true,
            entityId: true,
            canReadGraph: true,
            expiresAt: true,
            fileGrants: { select: { fileId: true } }
        }
    });
    if (!apiKey) {
        return null;
    }
    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
        return null;
    }

    await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
    });

    return {
        id: apiKey.id,
        entityId: apiKey.entityId,
        canReadGraph: apiKey.canReadGraph,
        fileIds: new Set(apiKey.fileGrants.map((grant) => grant.fileId))
    };
}

/**
 * Lists the files a key may read, as file metadata rather than bare ids so
 * a management UI can show names without a second lookup.
 * @param entityId - The id of the project the key must belong to
 * @param keyId - The id of the key
 * @returns The granted files, or an empty array if the key doesn't exist or belongs to another project
 */
async function listFileGrants(entityId: string, keyId: string) {
    const grants = await prisma.apiKeyFile.findMany({
        where: { apiKeyId: keyId, apiKey: { entityId } },
        orderBy: { createdAt: "desc" },
        select: {
            createdAt: true,
            file: { select: { id: true, fileName: true, size: true } }
        }
    });

    return grants.map((grant) => ({
        ...grant.file,
        grantedAt: grant.createdAt
    }));
}

/* -------------------------------- UPDATE -------------------------------- */

/**
 * Updates a key's graph permission and/or expiry. Omitted fields are left
 * as they are; pass `expiresAt: null` to remove an expiry entirely.
 * @param entityId - The id of the project the key must belong to
 * @param keyId - The id of the key to update
 * @param access - The fields to change
 * @throws {Error} If the key doesn't exist or belongs to a different project
 */
async function updateApiKeyAccess(
    entityId: string,
    keyId: string,
    access: { canReadGraph?: boolean; expiresAt?: Date | null }
): Promise<void> {
    const updated = await prisma.apiKey.updateMany({
        where: { id: keyId, entityId },
        data: access
    });
    if (updated.count === 0) {
        throw new Error(`API key not found: ${keyId}`);
    }
}

/**
 * Grants a key permission to read one file. Idempotent - re-granting an
 * already-granted file is a no-op rather than an error.
 *
 * File.id is globally unique, so the schema's foreign key alone can't keep
 * a grant inside the key's own project; this is where that's enforced.
 * @param entityId - The id of the project both the key and file must belong to
 * @param keyId - The id of the key to grant access to
 * @param fileId - The id of the file being granted
 * @throws {Error} If the key or file doesn't exist, or either belongs to a different project
 */
async function addFileGrant(
    entityId: string,
    keyId: string,
    fileId: string
): Promise<void> {
    const [apiKey, file] = await Promise.all([
        prisma.apiKey.findFirst({
            where: { id: keyId, entityId },
            select: { id: true }
        }),
        prisma.file.findFirst({
            where: { id: fileId, entityId },
            select: { id: true }
        })
    ]);
    if (!apiKey) {
        throw new Error(`API key not found: ${keyId}`);
    }
    if (!file) {
        throw new Error(`File not found in this project: ${fileId}`);
    }

    await prisma.apiKeyFile.upsert({
        where: { apiKeyId_fileId: { apiKeyId: keyId, fileId } },
        create: { apiKeyId: keyId, fileId },
        update: {}
    });
}

/* -------------------------------- DELETE -------------------------------- */

/**
 * Revokes a key's access to one file. A no-op if it was never granted.
 * @param entityId - The id of the project the key must belong to
 * @param keyId - The id of the key
 * @param fileId - The id of the file to revoke access to
 */
async function removeFileGrant(
    entityId: string,
    keyId: string,
    fileId: string
): Promise<void> {
    await prisma.apiKeyFile.deleteMany({
        where: { apiKeyId: keyId, fileId, apiKey: { entityId } }
    });
}

/**
 * Revokes (deletes) a project's API key. A no-op if the key doesn't exist
 * or belongs to a different project. Its file grants cascade away with it.
 * @param entityId - The id of the project the key must belong to
 * @param keyId - The id of the key to revoke
 */
async function revokeApiKey(entityId: string, keyId: string): Promise<void> {
    await prisma.apiKey.deleteMany({ where: { id: keyId, entityId } });
}

/* ------------------------------ EXPORTS -------------------------------- */
export {
    createApiKey,
    listApiKeys,
    listFileGrants,
    verifyApiKey,
    updateApiKeyAccess,
    addFileGrant,
    removeFileGrant,
    revokeApiKey,
    type VerifiedApiKey
};
