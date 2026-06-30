import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
import { env } from "@spine/shared";

let prisma: PrismaClient;

const adapter = new PrismaPg({
    connectionString: `postgresql://${env.DATABASE_URL_PLATFORM}`
});
const isDevMode = (env.NODE_ENV ?? "prod") === "dev";

if (isDevMode) {
    // Reuse existing instance in dev to avoid too many connections (HMR)
    const globalWithPrisma = global as typeof globalThis & {
        prisma?: PrismaClient;
    };
    if (!globalWithPrisma.prisma) {
        globalWithPrisma.prisma = new PrismaClient({
            adapter,
            log: ["query", "info", "warn", "error"]
        });
    }
    prisma = globalWithPrisma.prisma;
} else {
    prisma = new PrismaClient({
        adapter,
        log: ["error"]
    });
}

export { prisma };
