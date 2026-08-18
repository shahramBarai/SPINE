import { Activity, WifiOff } from "lucide-react";
import { cn } from "utils/index";
import { Logo } from "./Logo";
import { ProjectSelector } from "./ProjectSelector";
import ThemeButton from "components/complex/navigation/ThemButton";

const TopNav = ({ liveMode }: { liveMode: boolean }) => {
    // FIXME:
    const fusekiConnected = true;

    return (
        <header className="h-14 shrink-0 border-b border-border/60 glass-strong flex items-center px-4 gap-4 z-30 relative">
            <Logo />

            <ProjectSelector />

            {/* Search + status */}
            <div className="flex flex-1 items-center gap-3 justify-end">
                <ThemeButton />

                <div
                    className={cn(
                        "flex items-center gap-2 h-9 px-3 rounded-md border text-xs font-medium transition-all",
                        liveMode
                            ? "border-success/40 bg-success/10 text-success shadow-success"
                            : "border-border/60 bg-secondary/60 text-muted-foreground"
                    )}
                    aria-live="polite"
                >
                    <span className="relative flex h-2 w-2">
                        {liveMode && (
                            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                        )}
                        <span
                            className={cn(
                                "relative inline-flex h-2 w-2 rounded-full transition-colors",
                                liveMode
                                    ? "bg-success shadow-success"
                                    : "bg-muted-foreground/40"
                            )}
                        />
                    </span>
                    {liveMode ? (
                        <Activity className="h-3.5 w-3.5" />
                    ) : (
                        <WifiOff className="h-3.5 w-3.5" />
                    )}
                    LIVE
                </div>

                <div
                    className={cn(
                        "flex items-center gap-2 h-9 px-3 rounded-md border text-xs transition-all",
                        fusekiConnected
                            ? "border-success/40 bg-success/10 text-success shadow-success"
                            : "bg-secondary/60 border-border/60"
                    )}
                >
                    <span
                        className={cn(
                            "font-mono",
                            fusekiConnected
                                ? "text-success"
                                : "text-muted-foreground"
                        )}
                    >
                        Fuseki
                    </span>
                    {fusekiConnected ? (
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-success shadow-success" />
                        </span>
                    ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 transition-colors" />
                    )}
                </div>
            </div>
        </header>
    );
};

export { TopNav };
