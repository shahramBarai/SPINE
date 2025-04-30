import React from "react";
import { getNodeStyle, NodeTypeStyle } from "./styles";

// Define the different node types available in sidebar
export const sidebarNodeTypes = [
  {
    category: NodeTypeStyle.SOURCE,
    label: "Kafka Source",
  },
  { category: NodeTypeStyle.PROCESS, label: "Filter" },
];

export function Sidebar() {
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
        {sidebarNodeTypes.map((node) => {
          const style = getNodeStyle(node.category);
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
                style={{
                  background: style.background,
                  borderColor: style.borderColor,
                }}
                className="p-2 text-xs border flex items-center gap-2"
              >
                <span className="font-medium">{node.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default Sidebar;
