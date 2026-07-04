import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { router, createContext } from "./trpc";
import cors from "cors";
import { userRouter } from "./routers/user";
import { authRouter } from "./routers/auth";
import { digitalTwinRouter } from "./routers/digitalTwin";
import * as config from "./config";

export const appRouter = router({
    user: userRouter,
    auth: authRouter,
    digitalTwin: digitalTwinRouter
});
export type AppRouter = typeof appRouter;

// create server
const server = createHTTPServer({
    middleware: cors({
        origin: config.FRONTEND_URL,
        credentials: true
    }),
    router: appRouter,
    createContext
});

// start server
server.listen(Number(config.PORT), () => {
    console.log(`Server is running on port ${config.PORT}`);
});
