import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../trpc";

/**
 * Platform-wide admin tier, for procedures backing the /admin/* pages
 * (Kafka, schema registry, users, ...). This is the User.role check, and is
 * unrelated to the per-project membership tiers in `procedures/project.ts` -
 * a project OWNER is not an admin, and an admin gets no implicit project
 * access from this.
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.user.role !== "ADMIN") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "This resource requires administrator privileges"
        });
    }

    return next({ ctx });
});

export { adminProcedure };
