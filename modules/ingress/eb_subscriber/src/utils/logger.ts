import { NODE_ENV } from "./config";
import { createLogger } from "@spine/shared";

// const logger = createLogger({
//     level: NODE_ENV === "dev" ? "debug" : "error"
// });

const logger = createLogger({
    level: "error"
});

export { logger };
