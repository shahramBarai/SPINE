export type { PlatformConfig } from "./config";
export { initPlatformStorage } from "../prisma/client";
// Export all service functions
export * as UserService from "./services/userService";
export * as EntityService from "./services/entityService";
