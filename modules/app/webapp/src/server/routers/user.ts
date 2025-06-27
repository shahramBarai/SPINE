import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const userRouter = router({
  getById: publicProcedure.input(z.string()).query(async () => {
    // TODO: Use data-service to get user by id
    return null;
  }),

  create: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        password: z.string().min(8),
      })
    )
    .mutation(async () => {
      // TODO: Use data-service to create user
      return null;
    }),
});
