import React, { memo } from "react";
import { Node, NodeProps, Position } from "@xyflow/react";
import CustomHandle from "../CustomHandle";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";

export interface FilterData extends Node {
  data: { label: string; condition?: string };
}

const Filter = memo(({}: NodeProps<FilterData>) => {
  return (
    <>
      <CustomHandle
        type="target"
        position={Position.Left}
        connectionCount={1}
      />
      <div
        className="flex flex-col items-center justify-center bg-surface p-4 text-foreground w-32 rounded-md"
        onClick={() => {
          console.log("clicked");
        }}
      >
        <AdjustmentsHorizontalIcon className="w-10 h-10" />
        <div className="font-medium text-sm">Filter</div>
      </div>
      <CustomHandle type="source" position={Position.Right} />
    </>
  );
});

Filter.displayName = "Filter";

export default Filter;
