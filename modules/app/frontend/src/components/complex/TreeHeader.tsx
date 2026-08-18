import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
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

    /** Collapses when disabled - otherwise a row expanded before going
     *  disabled would stay expanded with no way left to collapse it. */
    useEffect(() => {
        if (disable) {
            setSectionExpanded(false);
        }
    }, [disable]);

    return (
        <>
            <div
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
                {button && (
                    // Stops the row's own toggle from firing when an action
                    // in the button slot (e.g. upload) is clicked.
                    <div onClick={(e) => e.stopPropagation()}>{button}</div>
                )}
            </div>
            {sectionExpanded && children}
        </>
    );
}

export { TreeHeader };
