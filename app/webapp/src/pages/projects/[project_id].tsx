import AppLayout from "@/client/layout/layout";
import FlowView from "@/client/components/complex/flink-pipeline/FlowView";
import { ReactFlowProvider, Node } from "@xyflow/react";
import PropertyPanel from "@/client/components/complex/flink-pipeline/PropertyPanel";
import { useState } from "react";

function Project() {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col w-full gap-2 p-4">
        <div className="grid grid-cols-[2fr_1fr] gap-2 min-h-[700px]">
          <FlowView
            className="border border-border rounded-tl-lg overflow-hidden"
            selectNode={setSelectedNode}
          />
          <PropertyPanel
            className="border border-border rounded-tr-lg overflow-scroll"
            node={selectedNode}
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

Project.getLayout = function getLayout(page: React.ReactNode) {
  return <AppLayout>{page}</AppLayout>;
};

export default Project;
