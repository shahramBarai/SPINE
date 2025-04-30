import Head from "next/head";
import "../../styles/globals.css";
import { Switch } from "../components/basics/switch";
import { useState } from "react";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  const toggleTheme = () => {
    setTheme((prevTheme) =>
      prevTheme === "light" ? "dark" : prevTheme === "dark" ? "system" : "light"
    );
  };

  return (
    <div className={theme}>
      <Head>
        <title>Webapp</title>
        <meta name="description" content="Webapp" />
        <link rel="icon" href="/globe.svg" />
      </Head>
      <main className="flex flex-col min-h-screen bg-background text-foreground">
        <div className="flex px-6 py-2 w-full items-center justify-end">
          <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
        </div>
        {children}
      </main>
    </div>
  );
}
