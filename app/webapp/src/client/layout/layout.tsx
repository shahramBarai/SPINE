import Head from "next/head";
import "../../styles/globals.css";
import Navbar from "../components/complex/navigation/Navbar";
import { useTheme } from "@/client/hooks/useTheme";
const navigation = [
  { name: "Dashboard", href: "/" },
  { name: "Projects", href: "/projects" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme } = useTheme();

  return (
    <div className={theme}>
      <Head>
        <title>Webapp</title>
        <meta name="description" content="Webapp" />
        <link rel="icon" href="/globe.svg" />
      </Head>
      <main className="flex flex-col min-h-screen bg-background text-foreground">
        <Navbar navigation={navigation} />
        {children}
      </main>
    </div>
  );
}
