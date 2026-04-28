import { env } from "@spine/shared";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: `postgresql://${env.DATABASE_URL_PLATFORM}`,
  },
});