import "../styles/globals.css";
import { AppProps } from "next/app";
import { ThemeProvider } from "@/client/hooks/useTheme";
import AppLayout from "@/client/layout/layout";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AppLayout>
        <Component {...pageProps} />
      </AppLayout>
    </ThemeProvider>
  );
}

export default MyApp;
