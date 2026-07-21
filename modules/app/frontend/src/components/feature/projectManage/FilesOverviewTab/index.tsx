import { FileStorageSection } from "./FileStorageSection";
import { FusekiGraphsSection } from "./FusekiGraphsSection";
import { ToolsSection } from "./ToolsSection";

function FilesOverviewTab({ projectId }: { projectId: string }) {
    return (
        <div className="w-full flex items-start gap-4">
            <div className="w-2/3 flex flex-col gap-4">
                <FileStorageSection projectId={projectId} />
                <FusekiGraphsSection projectId={projectId} />
            </div>
            <ToolsSection projectId={projectId} className="w-1/3" />
        </div>
    );
}

export { FilesOverviewTab };
