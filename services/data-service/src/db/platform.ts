import { Prisma, PrismaClient } from "../../generated/platform";
import { logger } from "../utils/logger";

// Initialize Platform PostgreSQL client
export const platformDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL_PLATFORM,
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "info" },
    { emit: "event", level: "warn" },
  ],
});

// Log database events
platformDb.$on("error", (event: Prisma.LogEvent) => {
  logger.error(event, "Platform DB Error");
});

platformDb.$on("warn", (event: Prisma.LogEvent) => {
  logger.warn(event, "Platform DB Warning");
});

platformDb.$on("info", (event: Prisma.LogEvent) => {
  logger.info(event, "Platform DB Info");
});
