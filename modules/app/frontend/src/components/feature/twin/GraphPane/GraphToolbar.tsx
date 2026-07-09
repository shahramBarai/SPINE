import {
    Crosshair,
    Filter,
    Pause,
    Play,
    RefreshCw,
    RotateCcw,
    Search
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "utils/index";
import { useGraphSearch } from "./hooks/useGraphSearch";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import type { GraphNode } from "./types/graph";

function GraphToolbar({
    nodes,
    onFitToScreen,
    onFocusSelection,
    physicsEnabled,
    onTogglePhysics,
    onRestoreLayout,
    onResetView,
    onToggleFilterPanel,
    filterActive,
    className
}: {
    nodes: GraphNode[];
    onFitToScreen: () => void;
    onFocusSelection: () => void;
    physicsEnabled: boolean;
    onTogglePhysics: () => void;
    onRestoreLayout: () => void;
    onResetView: () => void;
    onToggleFilterPanel: () => void;
    filterActive: boolean;
    className?: string;
}) {
    const [searchText, setSearchText] = useState("");
    const { setFocusObjectId } = useDigitalTwin();

    // Debounced against searchText, so typing doesn't thrash focusObjectId
    // on every keystroke - only once the user pauses.
    const searchMatchId = useGraphSearch({ nodes, searchText });
    useEffect(() => {
        setFocusObjectId(searchMatchId);
    }, [searchMatchId, setFocusObjectId]);

    const handleResetView = () => {
        onResetView();
        setSearchText("");
    };

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 p-1.5",
                "rounded-md bg-surface text-surface-foreground",
                "border border-border/60",
                className
            )}
        >
            <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search nodes and predicates"
                    className="h-7 w-40 pl-7 pr-2 rounded bg-background/70 border border-border/60 text-[11px] font-mono outline-none focus:border-primary/50"
                />
            </div>
            <button
                onClick={onFitToScreen}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Fit graph"
            >
                <Crosshair className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={onFocusSelection}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Focus selection"
            >
                <Search className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={onTogglePhysics}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                title={physicsEnabled ? "Pause physics" : "Resume physics"}
            >
                {physicsEnabled ? (
                    <Pause className="h-3.5 w-3.5" />
                ) : (
                    <Play className="h-3.5 w-3.5" />
                )}
            </button>
            <button
                onClick={onRestoreLayout}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Restore node layout"
            >
                <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
                onClick={onToggleFilterPanel}
                className="relative h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Filter by type"
            >
                <Filter className="h-3.5 w-3.5" />
                {filterActive && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
            </button>
            <button
                onClick={handleResetView}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10"
                title="Reset view"
            >
                <RotateCcw className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export { GraphToolbar };
