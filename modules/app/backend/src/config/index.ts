import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

// Database connection URL for the platform database
const DATABASE_URL_PLATFORM =
    process.env.DATABASE_URL_PLATFORM ||
    "username:password@localhost:5432/platform";

// Secret cookie password for session management
const SECRET_COOKIE_PASSWORD =
    process.env.SECRET_COOKIE_PASSWORD ||
    "complex_password_at_least_32_characters_long";

// Frontend URL for CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export {
    NODE_ENV,
    HOST,
    PORT,
    DATABASE_URL_PLATFORM,
    SECRET_COOKIE_PASSWORD,
    FRONTEND_URL
};
