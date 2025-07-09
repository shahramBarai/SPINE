import { router } from "../trpc";
import { userRouter } from "./user";
import { authRouter } from "./auth";
import { kafkaRouter } from "./kafka";

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
  kafka: kafkaRouter,
});

export type AppRouter = typeof appRouter;
