"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/client/context/AuthProvider";
import { Avatar } from "@/client/components/basics/Avatar";
import { Button } from "@/client/components/basics/Button";
import { cn } from "@/client/utils";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    HomeIcon,
    FolderIcon,
    CpuChipIcon,
    DocumentTextIcon,
    CogIcon,
    UsersIcon,
    ShieldCheckIcon,
    ArrowRightEndOnRectangleIcon,
} from "@heroicons/react/24/outline";
import ThemeButton from "./ThemButton";

interface NavigationItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
}

interface NavigationSection {
    title: string;
    items: NavigationItem[];
    requiresAdmin?: boolean;
}

const navigationSections: NavigationSection[] = [
    {
        title: "Platform",
        items: [
            { name: "Dashboard", href: "/dashboard", icon: HomeIcon },
            { name: "Projects", href: "/projects", icon: FolderIcon },
        ],
    },
    {
        title: "Administration",
        requiresAdmin: true,
        items: [
            { name: "Kafka", href: "/admin/kafka", icon: CpuChipIcon },
            { name: "Schemas", href: "/admin/schemas", icon: DocumentTextIcon },
            { name: "User Management", href: "/admin/users", icon: UsersIcon },
            { name: "System Settings", href: "/admin/settings", icon: CogIcon },
            {
                name: "Security",
                href: "/admin/security",
                icon: ShieldCheckIcon,
            },
        ],
    },
];

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const { user, signOut } = useAuth();
    const router = useRouter();

    const filteredSections = navigationSections.filter(
        (section) => !section.requiresAdmin || user?.role === "ADMIN"
    );

    return (
        <div
            className={cn(
                "fixed left-0 top-0 z-40 h-screen bg-background border-r border-border transition-all duration-300 ease-in-out",
                isCollapsed ? "w-16" : "w-64"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div
                    className={cn(
                        "flex items-center",
                        isCollapsed && "justify-center"
                    )}
                >
                    <Image
                        src="/metropolia-logo.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="flex-shrink-0"
                    />
                    {!isCollapsed && (
                        <span className="ml-2 text-lg font-semibold text-foreground">
                            IoT Platform
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="flex-shrink-0"
                >
                    {isCollapsed ? (
                        <ChevronRightIcon className="h-4 w-4" />
                    ) : (
                        <ChevronLeftIcon className="h-4 w-4" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto p-4">
                <nav className="space-y-6">
                    {filteredSections.map((section) => (
                        <div key={section.title}>
                            {!isCollapsed && (
                                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {section.title}
                                </h3>
                            )}
                            <ul className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive =
                                        router.asPath === item.href ||
                                        router.asPath.startsWith(
                                            item.href + "/"
                                        );
                                    return (
                                        <li key={item.name}>
                                            <Link
                                                href={item.href}
                                                className={cn(
                                                    "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                                                    isActive
                                                        ? "bg-primary text-primary-foreground"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                                                    isCollapsed
                                                        ? "justify-center"
                                                        : "justify-start"
                                                )}
                                                title={
                                                    isCollapsed
                                                        ? item.name
                                                        : undefined
                                                }
                                            >
                                                <item.icon className="h-5 w-5 flex-shrink-0" />
                                                {!isCollapsed && (
                                                    <>
                                                        <span className="ml-3">
                                                            {item.name}
                                                        </span>
                                                        {item.badge && (
                                                            <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-foreground bg-primary rounded-full">
                                                                {item.badge}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </div>

            {/* User Menu */}
            <div className="border-t border-border p-4">
                {user ? (
                    <div className="space-y-3">
                        <div
                            className={cn(
                                "flex items-center",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <Avatar
                                src={user.avatar}
                                alt={user.email}
                                className="h-8 w-8"
                            />
                            {!isCollapsed && (
                                <div className="ml-3 min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {user.fullName || user.email}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {user.role}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div
                            className={cn(
                                "flex items-center gap-2",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <ThemeButton />
                            <Button
                                variant="ghost"
                                size={isCollapsed ? "icon" : "sm"}
                                onClick={signOut}
                                className="text-muted-foreground hover:text-foreground"
                                title={isCollapsed ? "Sign out" : undefined}
                            >
                                <ArrowRightEndOnRectangleIcon className="h-4 w-4" />
                                {!isCollapsed && (
                                    <span className="ml-2">Sign out</span>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Link
                        href="/auth"
                        className={cn(
                            "flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent",
                            isCollapsed ? "justify-center" : "justify-start"
                        )}
                        title={isCollapsed ? "Sign in" : undefined}
                    >
                        <ArrowRightEndOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
                        {!isCollapsed && <span className="ml-3">Sign in</span>}
                    </Link>
                )}
            </div>
        </div>
    );
}
