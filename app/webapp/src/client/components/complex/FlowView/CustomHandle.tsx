import { Handle, HandleProps, useNodeConnections } from "@xyflow/react";
import { memo } from "react";

const CustomHandle = memo(
  ({
    type,
    connectionCount,
    isConnectable,
    position,
  }: HandleProps & { connectionCount?: number }) => {
    const connections = useNodeConnections({
      handleType: type,
    });

    console.log(connections.length);

    return (
      <Handle
        type={type}
        position={position}
        isConnectable={
          connectionCount ? connections.length < connectionCount : isConnectable
        }
        style={{
          width: 18,
          height: 18,
          background:
            connections.length !== connectionCount
              ? "var(--foreground)"
              : "var(--surface)",
          border:
            connections.length !== connectionCount
              ? "3px solid var(--surface)"
              : "1px solid var(--foreground)",
        }}
      />
    );
  }
);

CustomHandle.displayName = "CustomHandle";

export default CustomHandle;
