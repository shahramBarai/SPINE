import { env } from "@spine/shared";

import { initTimescaleStorage } from "../src/db/connection";
import { createSchema } from "../src/db/schema";

console.log("🔃​ Creating schema...\n");

initTimescaleStorage({
    databaseUrl: `postgresql://${env.DATABASE_URL_TIMESCALE}`
});

const { success, error } = await createSchema();

if (!success) {
    console.error("❌ Failed to create schema", error);
} else {
    console.log("\n✅ Schema created successfully");
}

process.exit(success ? 0 : 1);
