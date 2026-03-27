import winston from "winston";
import dotenv from "dotenv";
dotenv.config({ path: ["../../../.env", ".env"] });

const LOG_LEVEL = process.env.LOG_LEVEL;

// Create a logger instance
export const logger = winston.createLogger({
    level: LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length
                        ? JSON.stringify(meta, null, 2)
                        : ""}`;
                }),
            ),
        }),
    ],
});
