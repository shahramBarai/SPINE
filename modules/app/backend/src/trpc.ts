import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "./auth/iron-session";
import { type CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";

// Create context with session
async function createContext(opts: CreateHTTPContextOptions) {
    const session = await getServerSession(opts.req, opts.res);

    return {
        session,
        req: opts.req,
        res: opts.res
    };
}

// Create tRPC instance
type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create();

// --- Global Logger Middleware ---
const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
    const startTime = Date.now();

    // Execute the actual procedure resolver
    const result = await next();

    const durationMs = Date.now() - startTime;
    const status = result.ok ? "✅ SUCCESS" : "❌ ERROR";

    console.log(
        `[tRPC] ${new Date().toISOString()} | ${type} | path: ${path} | ${status} | duration: ${durationMs}ms`
    );

    if (!result.ok) {
        console.error(`  ↳ Error Details:`, result.error);
    }

    return result;
});

// Base router and procedures
const router = t.router;

// Public procedure that does not require authentication
const publicProcedure = t.procedure.use(loggerMiddleware);

// Protected procedure that requires authentication
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.session.data || !ctx.session.data.user) {
        throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "You must be logged in to access this resource"
        });
    }

    return next({
        ctx: {
            ...ctx,
            user: ctx.session.data.user
        }
    });
});

export type { Context };
export { createContext, router, publicProcedure, protectedProcedure };
