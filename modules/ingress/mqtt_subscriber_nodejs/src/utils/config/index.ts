import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const CLIENT_ID = process.env.CLIENT_ID || "mqtt_subscriber";

const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

export {
    CLIENT_ID,
    NODE_ENV,
    HOST,
    PORT
};

export * from "./kafka_config";
export * from "./mqtt_config";
