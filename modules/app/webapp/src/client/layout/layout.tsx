import Head from "next/head";
import Navbar from "../components/complex/navigation/Navbar";
import { useTheme } from "@/client/hooks/useTheme";
import { AuthProvider } from "../context/AuthProvider";
const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Projects", href: "/projects" },
  { name: "Kafka", href: "/kafka" },
];

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme } = useTheme();

  return (
    <AuthProvider>
      <div className={theme}>
        <Head>
          <title>Webapp</title>
          <meta name="description" content="Webapp" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main className="flex flex-col min-h-screen bg-background text-foreground">
          <Navbar navigation={navigation} />
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
