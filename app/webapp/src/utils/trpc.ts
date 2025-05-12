import { createTRPCNext } from "@trpc/next";
import { httpBatchLink } from "@trpc/client";
import { type AppRouter } from "@/server/routers";

export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: "http://localhost:3000/api/trpc",
        }),
      ],
    };
  },
});
