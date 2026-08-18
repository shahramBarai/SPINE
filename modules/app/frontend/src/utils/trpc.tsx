import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@server/server";
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { BACKEND_URL } from "./backendUrl";

const api = createTRPCReact<AppRouter>();

function ApiProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    const [trpcClient] = useState(() =>
        api.createClient({
            links: [
                splitLink({
                    condition: (op) => op.type === "subscription",
                    // Subscriptions (e.g. streamIfcGeometry) go over
                    // Server-Sent Events instead of a batched fetch -
                    // EventSource can't set a credentials fetch option, so
                    // cookie auth is opted into via withCredentials instead.
                    true: httpSubscriptionLink({
                        url: BACKEND_URL,
                        eventSourceOptions: { withCredentials: true }
                    }),
                    false: httpBatchLink({
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
