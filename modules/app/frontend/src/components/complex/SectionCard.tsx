import { type ReactNode } from "react";
import { cn } from "utils/index";

// A lightweight "titled section" wrapper for dashboard-style grids (distinct
// from TitledCard, which is a hoverable stat-card with its own skeleton
// loading state) - each section here manages its own loading/error UI
// internally, this just gives it a consistent header.
function SectionCard({
    title,
    action,
    className,
    children
}: {
    title: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </div>
    );
}

export { SectionCard };
