import { memo } from "react";
import { Handle, type HandleProps, useNodeConnections } from "@xyflow/react";
import { cn } from "utils/index";

/**
 * A node's connection point. `connectionCount` caps how many edges may
 * attach - once reached the handle stops accepting connections and renders
 * as filled rather than open.
 */
const CustomHandle = memo(
    ({
        type,
        isConnectable,
        position,
        connectionCount,
        selected
    }: HandleProps & { connectionCount?: number; selected?: boolean }) => {
        const connections = useNodeConnections({
            handleType: type
        });

        return (
            <Handle
                type={type}
                position={position}
                isConnectable={
                    connectionCount
                        ? connections.length < connectionCount
                        : isConnectable
                }
                className={cn(
                    "!z-10 !w-2 !h-6 !rounded-none !border-2",
                    selected
                        ? "!bg-primary !border-surface"
                        : connections.length !== connectionCount
                          ? "!bg-primary !border-muted"
                          : "!bg-surface !border-border"
                )}
            />
        );
    }
);

CustomHandle.displayName = "CustomHandle";

export default CustomHandle;
