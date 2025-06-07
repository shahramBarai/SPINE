import React, { memo } from "react";
import { Node, NodeProps, Position } from "@xyflow/react";
import { KafkaSourceFormValues } from "../PropertyPanel/KafkaSource/schemas";
import CustomHandle from "./CustomHandle";
import { cn } from "@/client/utils";
import { getNodeIcon, getNodeType, NodeType } from "../utils";

export interface CustomNodeData extends Node {
  data: KafkaSourceFormValues;
}

function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-surface p-4 w-32 rounded-md border-2",
        selected ? "border-primary" : "border-border"
      )}
    >
      {getNodeIcon(data.label, "lg")}
      <div className={cn("text-sm font-medium text-foreground")}>
        {data.label}
      </div>
      {getNodeType(data.label) !== NodeType.SOURCE && (
        <CustomHandle
          type="target"
          position={Position.Left}
          connectionCount={1}
          selected={selected}
        />
      )}
      {getNodeType(data.label) !== NodeType.SINK && (
        <CustomHandle
          type="source"
          position={Position.Right}
          selected={selected}
        />
      )}
    </div>
  );
}

export default memo(CustomNode);
