import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { router, createContext } from "./trpc";
import cors from "cors";
import { userRouter } from "./routers/user";
import { authRouter } from "./routers/auth";
import { digitalTwinRouter } from "./routers/digitalTwin";
import { env } from "@spine/shared";

export const appRouter = router({
    user: userRouter,
    auth: authRouter,
    digitalTwin: digitalTwinRouter
});
export type AppRouter = typeof appRouter;

// create server
const server = createHTTPServer({
    middleware: cors({
        origin: env.FRONTEND_URL,
        credentials: true
    }),
    router: appRouter,
    createContext
});

// start server
const port = env.BACKEND_URL.split(":")[2] || "4000";
server.listen(Number(port), () => {
    console.log(`Server is running on port ${port}`);
});
