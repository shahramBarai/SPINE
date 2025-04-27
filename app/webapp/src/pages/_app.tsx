import "../styles/globals.css";
import type { AppProps } from "next/app";
import AppLayout from "../client/layout/layout";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AppLayout>
      <Component {...pageProps} />
    </AppLayout>
  );
}
