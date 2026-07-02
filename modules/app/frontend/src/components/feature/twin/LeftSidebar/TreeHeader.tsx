import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "utils/index";

interface TreeHeaderProps {
    label: string | React.ReactNode;
    button?: React.ReactNode;
    children?: React.ReactNode;
}

function TreeHeader({ label, button, children }: TreeHeaderProps) {
    const [sectionExpanded, setSectionExpanded] = useState<boolean>(false);

    return (
        <>
            <div className={cn("flex items-center p-1")}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSectionExpanded((prev) => !prev);
                    }}
                    className={cn(
                        "flex flex-1 gap-2 items-center truncate",
                        "hover:cursor-pointer group"
                    )}
                >
                    <div
                        className={cn(
                            "rounded px-1 py-1 text-muted-foreground",
                            "group-hover:bg-accent group-hover:text-foreground"
                        )}
                    >
                        <ChevronRight
                            className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                sectionExpanded && "rotate-90"
                            )}
                        />
                    </div>
                    <div className="text-[11px] text-foreground font-mono truncate">
                        {label}
                    </div>
                </button>
                {button}
            </div>
            {sectionExpanded && children}
        </>
    );
}

export { TreeHeader };
