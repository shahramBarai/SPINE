import Head from "next/head";
import "../../styles/globals.css";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dark">
      <Head>
        <title>Webapp</title>
        <meta name="description" content="Webapp" />
        <link rel="icon" href="/globe.svg" />
      </Head>
      <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        {children}
      </main>
    </div>
  );
}
