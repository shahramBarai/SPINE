import { memo } from "react";
import { type Node, type NodeProps, Position } from "@xyflow/react";
import { cn } from "utils/index";
import { type KafkaSourceFormValues } from "../PropertyPanel/KafkaSource/schemas";
import { getNodeIcon, getNodeType, NodeType } from "../utils";
import CustomHandle from "./CustomHandle";

export interface CustomNodeData extends Node {
    data: KafkaSourceFormValues;
}

/**
 * Every node on the canvas renders through this - which handles it grows
 * depends on whether its label maps to a source, a sink, or a step in
 * between.
 */
function CustomNode({ data, selected }: NodeProps<CustomNodeData>) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center bg-surface p-4 w-32 rounded-md border-2",
                selected ? "border-primary" : "border-border"
            )}
        >
            {getNodeIcon(data.label, "lg")}
            <div className="text-sm font-medium text-foreground">
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
