import AppLayout from "../client/layout/layout";
import FlowView from "../client/components/complex/FlowView";
import { ReactFlowProvider } from "@xyflow/react";
import { PropertyPanel } from "@/client/components/complex/PropertyPanel";

function Home() {
  return (
    <ReactFlowProvider>
      <div className="flex flex-col w-full gap-2 p-4">
        <div className="grid grid-cols-[2fr_1fr] gap-2 min-h-[700px]">
          <FlowView className="border border-border rounded-tl-lg overflow-hidden" />
          <PropertyPanel className="border border-border rounded-tr-lg overflow-scroll" />
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
