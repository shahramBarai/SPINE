import { initTRPC } from "@trpc/server";
import { prisma } from "@/server/prisma";

export async function createContext() {
  return {
    prisma,
  };
}

const t = initTRPC.context<typeof createContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
