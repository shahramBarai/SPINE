// Node-only: loads the shared workspace env file (packages/shared/.env) via
// dotenv. Import this ONLY from vite.config.ts (a Node context) - it uses
// Node/dotenv APIs that don't exist in the browser and must never end up in
// the client bundle. We can't import @spine/shared's own env module here:
// Vite's config loader runs node_modules imports through plain Node ESM
// resolution, which can't resolve @spine/shared's extensionless TS-source
// entry point (only `tsx`'s loader hook, used by the backend, can).
import { config as loadDotenv } from "dotenv";
import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const SHARED_ENV_FILE = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "..",
    "..",
    "packages",
    "shared",
    ".env"
);

if (!existsSync(SHARED_ENV_FILE)) {
    throw new Error(`Missing workspace env file: ${SHARED_ENV_FILE}`);
}

loadDotenv({ path: SHARED_ENV_FILE });

function requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const env = {
    BACKEND_URL: requiredEnv("BACKEND_URL")
};

export { env };
