import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/server";
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";

const api = createTRPCReact<AppRouter>();

function ApiProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() =>
        api.createClient({
            links: [
                httpBatchLink({
                    url: "http://localhost:4000",
                    fetch(url, options) {
                        return fetch(url, {
                            ...options,
                            credentials: "include" // Include cookies in requests
                        });
                    },
                    // You can pass any HTTP headers you wish here
                    async headers() {
                        return {
                            //   authorization: getAuthCookie(),
                        };
                    }
                }),
                loggerLink({
                    enabled: (opts) =>
                        (process.env.NODE_ENV === "development" &&
                            typeof window !== "undefined") ||
                        (opts.direction === "down" &&
                            opts.result instanceof Error)
                })
            ]
        })
    );

    return (
        <api.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </api.Provider>
    );
}

export { api, ApiProvider };
