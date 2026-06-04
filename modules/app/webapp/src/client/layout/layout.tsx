import Head from "next/head";
import { useState } from "react";
import { useTheme } from "@/client/hooks/useTheme";
import { AuthProvider } from "../context/AuthProvider";
import Sidebar from "../components/complex/navigation/Sidebar";
import { cn } from "@/client/utils";

export default function AppLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { theme } = useTheme();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    return (
        <AuthProvider>
            <div className={theme}>
                <Head>
                    <title>IoT Platform</title>
                    <meta
                        name="description"
                        content="IoT Platform - Multi-level Digital Twins"
                    />
                    <link rel="icon" href="/favicon.ico" />
                </Head>
                <div className="flex h-screen bg-background">
                    <Sidebar
                        isCollapsed={sidebarCollapsed}
                        onToggle={toggleSidebar}
                    />
                    <main
                        className={cn(
                            "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
                            sidebarCollapsed ? "ml-16" : "ml-64"
                        )}
                    >
                        <div className="flex-1 overflow-auto">
                            <div className="h-full">{children}</div>
                        </div>
                    </main>
                </div>
            </div>
        </AuthProvider>
    );
}
