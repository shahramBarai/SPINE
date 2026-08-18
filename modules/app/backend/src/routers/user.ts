import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { UserService } from "@spine/storage-platform";
import { TRPCError } from "@trpc/server";

export const userRouter = router({
    getById: publicProcedure.input(z.string()).query(async ({ input }) => {
        try {
            return await UserService.getUserById(input);
        } catch (error) {
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to get user by id",
                cause: error
            });
        }
    }),

    search: protectedProcedure
        .input(
            z.object({
                query: z.string().min(1),
                excludeUserIds: z.array(z.string()).optional()
            })
        )
        .query(async ({ input }) => {
            return await UserService.searchUsers(input.query, {
                excludeIds: input.excludeUserIds
            });
        })
});
