import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const NODE_ENV: "prod" | "dev" = (process.env.NODE_ENV || "prod") as
    | "prod"
    | "dev";
const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Options: kafka, excel, or console
// - kafka: Send data to Kafka topic
// - excel: Save data to Excel file
// - console: Log data to console
const SEND_TO = process.env.SEND_TO || "kafka";
if (SEND_TO !== "kafka" && SEND_TO !== "excel" && SEND_TO !== "console") {
    throw new Error(`SEND_TO must be one of: kafka, excel, console`);
}

export {
    NODE_ENV,
    HOST,
    PORT,
    SEND_TO,
};

export * from "./kafka_config";
export * from "./eb_config";
