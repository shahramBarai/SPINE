import { useState } from "react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import { pageGuard } from "utils/pageGuard";
import { BreadCrumb } from "components/complex/navigation/BreadCrumb";
import FlowView from "components/feature/flinkPipeline/FlowView";
import PropertyPanel from "components/feature/flinkPipeline/PropertyPanel";

function PipelinePageContent({ projectId }: { projectId: string }) {
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    return (
        <ReactFlowProvider>
            <div className="flex flex-col w-full gap-2 p-4">
                <BreadCrumb
                    homeHref="/"
                    pages={[
                        { name: "Projects", href: "/projects" },
                        {
                            name: "Pipeline",
                            href: `/projects/${projectId}/pipeline`,
                            current: true
                        }
                    ]}
                />
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

// The canvas is still local state only - nothing is loaded or saved yet, so
// the guard just establishes that a project is in scope.
const PipelinePage = pageGuard(PipelinePageContent, {
    params: ["projectId"],
    handler: ({ projectId }) => ({ data: { projectId } })
});

export { PipelinePage };
