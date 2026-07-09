import { type RefObject, useEffect, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";
import { type GraphNode } from "./types/graph";
import { useDigitalTwin } from "hooks/useDigitalTwin";
import { cn } from "utils/index";

function SelectionPanel({
    containerRef,
    nodes
}: {
    containerRef: RefObject<HTMLDivElement | null>;
    nodes: GraphNode[];
}) {
    const { focusObjectId, setFocusObjectId } = useDigitalTwin();
    const node = nodes.find((n) => n.id === focusObjectId) ?? null;

    const [position, setPosition] = useState<{ x: number; y: number }>({
        x: 12,
        y: 208
    });
    const draggingRef = useRef(false);
    const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            if (!draggingRef.current) {
                return;
            }

            const container = containerRef.current;
            const offset = dragOffsetRef.current;
            if (!container || !offset) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const nextX = Math.max(
                12,
                Math.min(rect.width - 220, event.clientX - rect.left - offset.x)
            );
            const nextY = Math.max(
                56,
                Math.min(rect.height - 80, event.clientY - rect.top - offset.y)
            );
            setPosition({ x: nextX, y: nextY });
        };

        const stopDragging = () => {
            draggingRef.current = false;
            dragOffsetRef.current = null;
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopDragging);
        window.addEventListener("pointercancel", stopDragging);

        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", stopDragging);
            window.removeEventListener("pointercancel", stopDragging);
        };
    }, [containerRef]);

    if (!node) {
        return null;
    }

    const rows = [
        { label: "Name", value: node.label },
        { label: "Id", value: node.id },
        { label: "Type", value: node.type }
    ];

    return (
        <div
            className={cn(
                "absolute z-20 w-72 overflow-hidden",
                "rounded-md border border-border/60 bg-background/90",
                "shadow-elevated backdrop-blur-md"
            )}
            style={{ left: `${position.x}px`, top: `${position.y}px` }}
        >
            <div
                className="flex cursor-grab items-center justify-between border-b border-border/60 px-3 py-2 active:cursor-grabbing"
                onPointerDown={(event) => {
                    event.stopPropagation();
                    const panelRect =
                        event.currentTarget.parentElement?.getBoundingClientRect();
                    if (!panelRect) {
                        return;
                    }
                    draggingRef.current = true;
                    dragOffsetRef.current = {
                        x: event.clientX - panelRect.left,
                        y: event.clientY - panelRect.top
                    };
                }}
            >
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
                    Properties
                </div>
                <div className="flex items-center gap-2">
                    <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <button
                        type="button"
                        className="rounded p-1 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                        aria-label="Close properties"
                        onClick={(event) => {
                            event.stopPropagation();
                            draggingRef.current = false;
                            dragOffsetRef.current = null;
                            setFocusObjectId(null);
                        }}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            <div className="space-y-1 px-3 py-2 text-[11px]">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="border-b border-border/30 pb-1 last:border-b-0"
                    >
                        <div className="text-[10px] font-mono text-primary">
                            {row.label}
                        </div>
                        <div className="wrap-break-word font-mono text-[10px] text-muted-foreground">
                            {row.value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export { SelectionPanel };
