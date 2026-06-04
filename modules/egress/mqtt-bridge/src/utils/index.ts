import dotenv from "dotenv";
dotenv.config();

const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

export { NODE_ENV, HOST, PORT };

export * from "./mqtt_config";
export * from "./kafka_config";
