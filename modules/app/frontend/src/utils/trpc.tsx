import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/server";
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { BACKEND_URL } from "./backendUrl";

const api = createTRPCReact<AppRouter>();

function ApiProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() =>
        api.createClient({
            links: [
                httpBatchLink({
                    url: BACKEND_URL,
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
