import { Crosshair } from "lucide-react";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { cn } from "utils/index";

function FocusButton({
    nodeId,
    className
}: {
    nodeId: string;
    className?: string;
}) {
    const { focusId, setFocusId } = useDigitalTwin();
    const isFocused = focusId === nodeId;

    return (
        <button
            type="button"
            className={cn(
                "rounded p-1 transition",
                "hover:cursor-pointer hover:bg-primary/10 hover:text-primary",
                isFocused ? "text-primary" : "text-muted-foreground",
                className
            )}
            aria-label="Set as relationship graph focus"
            title="Set as relationship graph focus"
            onClick={(event) => {
                event.stopPropagation();
                setFocusId(nodeId);
            }}
        >
            <Crosshair className="h-3.5 w-3.5" />
        </button>
    );
}

export { FocusButton };
