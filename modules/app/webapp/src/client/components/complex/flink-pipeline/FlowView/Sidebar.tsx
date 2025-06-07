import React, { memo } from "react";
import { cn } from "@/client/utils";
import { nodeItems, NodeType, getNodeIcon } from "../utils";

const Sidebar = memo(() => {
  const onDragStart = (
    event: React.DragEvent,
    nodeType: string,
    nodeLabel: string
  ) => {
    const data = JSON.stringify({ type: nodeType, label: nodeLabel });
    event.dataTransfer.setData("application/reactflow", data);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-48 bg-surface p-2 border-r border-border h-full overflow-y-auto">
      <div className="font-medium text-sm mb-2 text-muted-foreground">
        Components
      </div>
      <div className="space-y-2">
        {nodeItems.map((node) => {
          return (
            <div
              key={node.label}
              className="cursor-grab rounded overflow-hidden"
              onDragStart={(event) =>
                onDragStart(event, "CustomNode", node.label)
              }
              draggable
            >
              <div
                className={cn(
                  "text-xs border-2 border-border rounded-md flex items-center mx-1",
                  "border-border hover:border-primary group"
                )}
              >
                {node.type !== NodeType.SOURCE && (
                  <div
                    className={cn(
                      "z-10 w-2 h-5 rounded-none border-2 bg-primary/70 border-surface group-hover:bg-primary",
                      "ml-[-6px]"
                    )}
                  />
                )}
                <div className="flex items-center gap-2 w-full p-2">
                  {getNodeIcon(node.label, "sm")}
                  <span className="font-medium">{node.label}</span>
                </div>
                {node.type !== NodeType.SINK && (
                  <div
                    className={cn(
                      "z-10 w-2 h-5 rounded-none border-2 bg-primary/70 border-surface group-hover:bg-primary",
                      "mr-[-6px]"
                    )}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
});

Sidebar.displayName = "Sidebar";

export default Sidebar;
