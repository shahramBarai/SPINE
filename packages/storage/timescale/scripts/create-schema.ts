import { createSchema } from "../src/db/schema";

console.log("🔃​ Creating schema...\n");

const { success, error } = await createSchema();

if (!success) {
    console.error("❌ Failed to create schema", error);
}

console.log("\n✅ Schema created successfully");

process.exit(success ? 0 : 1);