import { initTRPC, TRPCError } from "@trpc/server";
import { getServerSession } from "@/server/auth/iron-session";
import { NextApiRequest, NextApiResponse } from "next";

// Create context with session
export async function createContext({
  req,
  res,
}: {
  req: NextApiRequest;
  res: NextApiResponse;
}) {
  const session = await getServerSession(req, res);

  return {
    session,
    req,
    res,
  };
}

// Create tRPC instance
const t = initTRPC.context<typeof createContext>().create();

// Base router and procedures
export const router = t.router;

export const publicProcedure = t.procedure;

// Protected procedure that requires authentication
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session.data || !ctx.session.data.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.session.data.user,
    },
  });
});
