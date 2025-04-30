import AppLayout from "../client/layout/layout";
import FlowView from "../client/components/complex/FlowView";
import { ReactFlowProvider, Node, useNodesState } from "@xyflow/react";
import { PropertyPanel } from "@/client/components/complex/PropertyPanel";
import { useState, useCallback } from "react";
import { KafkaSourceFormValues } from "@/client/components/complex/PropertyPanel/KafkaSource/schemas";

// Initial nodes using our custom node types
const initialNodes: Node[] = [];

function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Node update handler
  const handleNodeUpdate = useCallback(
    (nodeId: string, newData: KafkaSourceFormValues) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            // Update the node data
            return {
              ...node,
              data: {
                ...node.data,
                ...newData,
              },
            };
          }
          return node;
        })
      );

      // Also update the selected node to reflect changes
      if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode((currentNode) => {
          if (currentNode) {
            return {
              ...currentNode,
              data: {
                ...currentNode.data,
                ...newData,
              },
            };
          }
          return currentNode;
        });
      }
    },
    [setNodes, selectedNode]
  );

  return (
    <ReactFlowProvider>
      <div className="flex flex-col w-full gap-2 p-4">
        <div className="grid grid-cols-[2fr_1fr] gap-2 min-h-[700px]">
          <FlowView
            className="border border-border rounded-tl-lg overflow-hidden"
            nodes={nodes}
            setNodes={setNodes}
            onNodesChange={onNodesChange}
            selectNode={setSelectedNode}
          />
          <PropertyPanel
            className="border border-border rounded-tr-lg overflow-scroll"
            selectedNode={selectedNode}
            onNodeUpdate={handleNodeUpdate}
          />
        </div>
        <div className="flex h-full p-2 rounded-b-lg border border-border overflow-hidden">
          <div className="text-sm text-muted-foreground">
            Data preview panel
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

Home.getLayout = function getLayout(page: React.ReactNode) {
  return <AppLayout>{page}</AppLayout>;
};

export default Home;
