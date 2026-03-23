import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';
import { type PlatformConfig } from '../src/config';

let prisma: PrismaClient | null = null;

/**
 * Initialise the Prisma client with the supplied configuration.
 * Must be called once at service startup before any queries.
 */
function initPlatformStorage(config: PlatformConfig): void {
    if (prisma) {
        return; // already initialised
    }

    const adapter = new PrismaPg({ connectionString: config.databaseUrl });
    const isDevMode = (config.nodeEnv ?? 'prod') === 'dev';

    if (isDevMode) {
        // Reuse existing instance in dev to avoid too many connections (HMR)
        const globalWithPrisma = global as typeof globalThis & { prisma?: PrismaClient };
        if (!globalWithPrisma.prisma) {
            globalWithPrisma.prisma = new PrismaClient({
                adapter,
                log: ['query', 'info', 'warn', 'error'],
            });
        }
        prisma = globalWithPrisma.prisma;
    } else {
        prisma = new PrismaClient({
            adapter,
            log: ['error'],
        });
    }
}

function getPrisma(): PrismaClient {
    if (!prisma) {
        throw new Error("Prisma client not initialised. Call initDb() first.");
    }
    return prisma;
}

export { initPlatformStorage, getPrisma };