import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "utils/index";

// Stand-in for pane content until it's wired up to real data (ViewerPane,
// GraphPane, BottomPanel are ported from the old app but not yet adapted to
// this app's tRPC-based data layer).
function PlaceholderPane({
    icon: Icon,
    label,
    hidden,
    maximized,
    onToggleMaximize,
    collapsed,
    onToggleCollapsed
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    hidden?: boolean;
    maximized: boolean;
    onToggleMaximize: () => void;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
}) {
    return (
        <section
            className={cn(
                "h-full min-w-0 flex flex-col rounded-lg border border-border/60 bg-secondary/20 overflow-hidden",
                hidden ? "hidden" : ""
            )}
            aria-label={label}
            aria-hidden={hidden}
        >
            <header className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-border/60">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-mono text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {label}
                </div>
                <div className="flex items-center gap-1">
                    {onToggleCollapsed && (
                        <button
                            onClick={onToggleCollapsed}
                            className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground"
                            title={collapsed ? "Expand" : "Collapse"}
                        >
                            {collapsed ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                            )}
                        </button>
                    )}
                    <button
                        onClick={onToggleMaximize}
                        className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground"
                        title={maximized ? "Restore" : "Maximize"}
                    >
                        {maximized ? (
                            <Minimize2 className="h-3.5 w-3.5" />
                        ) : (
                            <Maximize2 className="h-3.5 w-3.5" />
                        )}
                    </button>
                </div>
            </header>
            {!collapsed && (
                <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground">
                    Coming soon
                </div>
            )}
        </section>
    );
}

export { PlaceholderPane };
