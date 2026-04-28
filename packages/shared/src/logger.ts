import winston from "winston";
import { env } from "./env";

type LogLevels = "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";
type LoggerMethod = (message: string, ...meta: unknown[]) => void;

type AppLogger = {
    error: LoggerMethod;
    warn: LoggerMethod;
    info: LoggerMethod;
    http: LoggerMethod;
    verbose: LoggerMethod;
    debug: LoggerMethod;
    silly: LoggerMethod;
};

/**
 * Creates a logger instance with the specified log level.
 * 
 * Levels are prioritized as follows: `error` > `warn` > `info` > `http` > `verbose` > `debug` > `silly`.
 * Log only if "log_level" is less than or equal to the specified level.
 * For example, if "log_level" is set to "info", then "error", "warn", and "info" messages will be logged, but "http", "verbose", "debug", and "silly" messages will not be logged.
 * 
 * @param log_level - The log level to use for the logger (default: `info`).
 * @returns A instance configured with the specified log level and a console transport.
 * 
 * @example
 * import { createLogger } from "@spine/shared";
 * const logger = createLogger({ level: "warn" });
 * logger.error("This is an error message");    # Printed
 * logger.warn("This is a warning message");    # Printed
 * logger.info("This is an info message");      # Not Printed
 * logger.http("This is an http message");      # Not Printed
 * logger.verbose("This is a verbose message"); # Not Printed
 * logger.debug("This is a debug message");     # Not Printed
 * logger.silly("This is a silly message");     # Not Printed
 * 
 * @see
 * - [Winston Documentation](https://www.npmjs.com/package/winston) for more details on logging levels and configuration options.
 */
function createLogger({ level = "info", }:{ level?: LogLevels }): AppLogger {
    const logger = winston.createLogger({
        level: level,
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

    return logger as AppLogger;
};

/**
 * Default logger instance with log level determined by the `NODE_ENV` environment variable.
 * If `NODE_ENV` is set to "dev", the log level will be "debug" (more verbose). For any other value of `NODE_ENV`, the log level will be "error" (less verbose).
 * This allows for more detailed logging during development while keeping logs cleaner in production.
 * 
 * @example
 * // In development (NODE_ENV=prod)
 * import { logger } from "@spine/shared";
 * logger.error("This is an error message");    # Printed
 * logger.warn("This is a warning message");    # Not Printed
 * logger.info("This is an info message");      # Not Printed
 * ...
 * logger.debug("This is a debug message");     # Not Printed
 * ...
 */
const logger = createLogger({ level: env.NODE_ENV === "dev" ? "debug" : "error" });

export type { AppLogger, LogLevels };
export { createLogger, logger };
