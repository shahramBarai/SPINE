import { cn } from "@/client/utils";
import { Handle, HandleProps, useNodeConnections } from "@xyflow/react";
import { memo } from "react";

const CustomHandle = memo(
  ({
    type,
    isConnectable,
    position,
    connectionCount,
    selected,
  }: HandleProps & { connectionCount?: number; selected?: boolean }) => {
    const connections = useNodeConnections({
      handleType: type,
    });

    return (
      <Handle
        type={type}
        position={position}
        isConnectable={
          connectionCount ? connections.length < connectionCount : isConnectable
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
