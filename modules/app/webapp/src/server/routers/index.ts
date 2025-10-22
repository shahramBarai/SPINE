import { router } from "../trpc";
import { userRouter } from "./user";
import { authRouter } from "./auth";
import { kafkaRouter } from "./kafka";
import { schemaRegistryRouter } from "./schema-registry";
import { entitiesRouter } from "./entities";

export const appRouter = router({
  user: userRouter,
  auth: authRouter,
  kafka: kafkaRouter,
  schemaRegistry: schemaRegistryRouter,
  entities: entitiesRouter,
});

export type AppRouter = typeof appRouter;
