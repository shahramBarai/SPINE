"use client";

import { Avatar } from "components/basics/Avatar";
import { Button } from "components/basics/Button";
import { cn } from "utils/index";
import {
    ChevronLeftIcon,
    HomeIcon,
    FolderIcon,
    CpuChipIcon,
    DocumentTextIcon,
    UsersIcon,
    ArrowRightEndOnRectangleIcon
} from "@heroicons/react/24/outline";
import ThemeButton from "./ThemButton";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useState } from "react";

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
            { name: "Projects", href: "/projects", icon: FolderIcon }
        ]
    },
    {
        title: "Administration",
        requiresAdmin: true,
        items: [
            { name: "Kafka", href: "/admin/kafka", icon: CpuChipIcon },
            { name: "Schemas", href: "/admin/schemas", icon: DocumentTextIcon },
            { name: "User Management", href: "/admin/users", icon: UsersIcon }
        ]
    }
];

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const { user, signOut } = useAuth();

    const location = useLocation();

    const filteredSections = navigationSections.filter(
        (section) => !section.requiresAdmin || user?.role === "ADMIN"
    );

    return (
        <div
            className={cn(
                "h-full bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out",
                "flex flex-col justify-between",
                isCollapsed ? "w-16" : "w-56"
            )}
        >
            {/* Header + Navigation */}
            <div>
                {/* Header */}
                <div
                    className={cn(
                        "flex items-center justify-between border-b border-border",
                        "p-4"
                    )}
                >
                    <a
                        href="/"
                        className={cn(
                            "flex items-center hover:opacity-80 transition-opacity hover:cursor-pointer h-12"
                        )}
                    >
                        {isCollapsed ? (
                            <img
                                src="/favicon.ico"
                                alt="Logo"
                                className="h-8 hidden"
                            />
                        ) : (
                            <img
                                src="/metropolia-logo.png"
                                alt="Logo"
                                className="h-12"
                            />
                        )}
                    </a>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed((prev) => !prev)}
                        className={cn("shrink-0", isCollapsed && "rotate-180")}
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </Button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto p-4">
                    <nav className="space-y-2">
                        {filteredSections.map((section) => (
                            <div key={section.title}>
                                <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {!isCollapsed ? (
                                        section.title
                                    ) : (
                                        <span className="border-b border-muted-foreground w-full block" />
                                    )}
                                </h3>
                                <ul className="space-y-1">
                                    {section.items.map((item) => {
                                        const isActive =
                                            location.pathname === item.href ||
                                            location.pathname.startsWith(
                                                item.href + "/"
                                            );
                                        return (
                                            <li key={item.name}>
                                                <a
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
                                                    <item.icon className="h-5 w-5 shrink-0" />
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
                                                </a>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </div>
            </div>

            {/* User Menu */}
            <div className="flex flex-col border-t border-border p-4 gap-2">
                {user && (
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
                    </div>
                )}
                <div
                    className={cn(
                        "flex items-center gap-2 px-4",
                        isCollapsed && "flex-col"
                    )}
                >
                    <ThemeButton />
                    {user ? (
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
                    ) : (
                        <Button
                            variant="ghost"
                            size={isCollapsed ? "icon" : "sm"}
                            href="/auth"
                            className="text-muted-foreground hover:text-foreground"
                            title={isCollapsed ? "Sign in" : undefined}
                        >
                            {!isCollapsed && (
                                <span className="ml-2">Sign in</span>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
