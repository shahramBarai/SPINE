type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: unknown) {
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

    if (meta === undefined) {
        method(`[${level}] ${message}`);
        return;
    }

    method(`[${level}] ${message}`, meta);
}

export const logger = {
    debug(message: string, meta?: unknown) {
        log("debug", message, meta);
    },
    info(message: string, meta?: unknown) {
        log("info", message, meta);
    },
    warn(message: string, meta?: unknown) {
        log("warn", message, meta);
    },
    error(message: string, meta?: unknown) {
        log("error", message, meta);
    }
};