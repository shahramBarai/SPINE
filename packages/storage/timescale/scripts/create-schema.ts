import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../../");

dotenv.config({
    path: [path.join(repoRoot, ".env"), path.join(repoRoot, ".env.example")]
});

if (!process.env.DATABASE_URL_TIMESCALE) {
    throw new Error(
        "DATABASE_URL_TIMESCALE is not defined. Set it in .env or rely on .env.example."
    );
}

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
