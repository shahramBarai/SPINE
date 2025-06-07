import { router } from "../trpc";
import { userRouter } from "./user";
import { authRouter } from "./auth";

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
