import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { router, createContext } from "./trpc";
import cors from "cors";
import { userRouter } from "./routers/user";
import { authRouter } from "./routers/auth";
import { digitalTwinRouter } from "./routers/digitalTwin";
import { projectRouter } from "./routers/project";
import { handleProjectFilesRoute } from "./routes/projectFiles";
import { env } from "@spine/shared";

export const appRouter = router({
    user: userRouter,
    auth: authRouter,
    digitalTwin: digitalTwinRouter,
    project: projectRouter
});
export type AppRouter = typeof appRouter;

// create server
const corsMiddleware = cors({
    origin: env.FRONTEND_URL,
    credentials: true
});

const server = createHTTPServer({
    middleware: (req, res, next) => {
        corsMiddleware(req, res, () => {
            handleProjectFilesRoute(req, res).then((handled) => {
                if (!handled) next();
            });
        });
    },
    router: appRouter,
    createContext
});

// start server
const port = env.BACKEND_URL.split(":")[2] || "4000";
server.listen(Number(port), () => {
    console.log(`Server is running on port ${port}`);
});
