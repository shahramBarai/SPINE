import "../styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/client/hooks/useTheme";
import type { NextPage } from "next";
import type { ReactElement, ReactNode } from "react";
import { api } from "@/utils/trpc";

export type NextPageWithLayout<P = Record<string, never>, IP = P> = NextPage<
    P,
    IP
> & {
    getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
    Component: NextPageWithLayout;
};

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
    const getLayout = Component.getLayout || ((page) => page);

    return (
        <ThemeProvider>{getLayout(<Component {...pageProps} />)}</ThemeProvider>
    );
}

export default api.withTRPC(MyApp);
