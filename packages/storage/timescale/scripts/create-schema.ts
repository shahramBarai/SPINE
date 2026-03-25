import dotenv from "dotenv";
dotenv.config({ path: "../../../../.env" });

if (!process.env.DATABASE_URL_TIMESCALE) {
    throw new Error("DATABASE_URL_TIMESCALE is not defined");
}

import { initTimescaleStorage } from "../src/db/connection";
import { createSchema } from "../src/db/schema";

console.log("🔃​ Creating schema...\n");

await initTimescaleStorage({
    databaseUrl: `postgresql://${process.env.DATABASE_URL_TIMESCALE}`,
});

const { success, error } = await createSchema();

if (!success) {
    console.error("❌ Failed to create schema", error);
} else {
    console.log("\n✅ Schema created successfully");
}

process.exit(success ? 0 : 1);