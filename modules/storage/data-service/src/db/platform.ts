import { PrismaClient as PlatformPrismaClient } from "../../generated/platform";

// Export all types from the generated Prisma client
export * from "../../generated/platform";

// Create and export a singleton instance
export const platformDb = new PlatformPrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});
