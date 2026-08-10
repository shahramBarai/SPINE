import { cn } from "utils/index";

interface Tab<T extends string> {
    id: T;
    label: string;
}

function TabBar<T extends string>({
    tabs,
    active,
    onChange,
    className
}: {
    tabs: Tab<T>[];
    active: T;
    onChange: (id: T) => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex items-center gap-1 border-b border-border",
                className
            )}
        >
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                        "hover:cursor-pointer",
                        active === tab.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export { TabBar };
