import { Prisma, PrismaClient } from "../../generated/timescale";
import { logger } from "../utils/logger";

// Initialize TimescaleDB client
export const timescaleDb = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL_TIMESCALE,
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "info" },
    { emit: "event", level: "warn" },
  ],
});

// Log database events
timescaleDb.$on("error", (event: Prisma.LogEvent) => {
  logger.error(event, "TimescaleDB Error");
});

timescaleDb.$on("warn", (event: Prisma.LogEvent) => {
  logger.warn(event, "TimescaleDB Warning");
});

timescaleDb.$on("info", (event: Prisma.LogEvent) => {
  logger.info(event, "TimescaleDB Info");
});
