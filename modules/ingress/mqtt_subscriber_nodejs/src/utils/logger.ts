import { NODE_ENV } from "./config";
import { createLogger } from "@spine/shared";

const logger = createLogger({
    level: NODE_ENV === "prod" ? "error" : "debug"
});

export { logger };
