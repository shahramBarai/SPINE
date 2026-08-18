import Sidebar from "components/complex/navigation/Sidebar";

export default function AppLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex flex-row h-screen w-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 h-full overflow-auto">{children}</main>
        </div>
    );
}
