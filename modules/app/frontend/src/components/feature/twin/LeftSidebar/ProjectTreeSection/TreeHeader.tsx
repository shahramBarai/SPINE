import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "utils/index";

interface TreeHeaderProps {
    label: React.ReactNode;
    button?: React.ReactNode;
    children?: React.ReactNode;
    disable?: boolean;
    defaultExpanded?: boolean;
    className?: string;
}

function TreeHeader({
    label,
    button,
    children,
    disable = false,
    defaultExpanded = false,
    className
}: TreeHeaderProps) {
    const [sectionExpanded, setSectionExpanded] =
        useState<boolean>(defaultExpanded);

    return (
        <>
            <button
                className={cn(
                    "flex items-center px-1 w-full",
                    disable ? "opacity-50" : "cursor-pointer hover:bg-accent",
                    className
                )}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!disable) setSectionExpanded((prev) => !prev);
                }}
            >
                <div
                    className={cn(
                        "flex flex-1 px-1 py-2 gap-2 items-center truncate"
                    )}
                >
                    <ChevronRight
                        className={cn(
                            "h-3 w-3 transition-transform text-muted-foreground",
                            sectionExpanded && "rotate-90"
                        )}
                    />
                    {label}
                </div>
                {button}
            </button>
            {sectionExpanded && children}
        </>
    );
}

export { TreeHeader };
