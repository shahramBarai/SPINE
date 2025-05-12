import { createNextApiHandler } from "@trpc/server/adapters/next";
import { createContext } from "@/server/trpc";
import { appRouter } from "@/server/routers";
// @link https://nextjs.org/docs/api-routes/introduction
export default createNextApiHandler({
  router: appRouter,
  createContext,
});
