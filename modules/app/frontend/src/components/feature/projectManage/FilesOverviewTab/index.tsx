import { FileStorageSection } from "./FileStorageSection";
import { FusekiGraphsSection } from "./FusekiGraphsSection";
import { ToolsSection } from "./ToolsSection";
import { JobHistorySection } from "./JobHistorySection";

function FilesOverviewTab({ projectId }: { projectId: string }) {
    return (
        <div className="w-full flex items-start gap-4">
            <div className="w-3/5 flex flex-col gap-4">
                <FileStorageSection projectId={projectId} />
                <FusekiGraphsSection projectId={projectId} />
            </div>
            <div className="w-2/5 flex flex-col gap-4">
                <ToolsSection projectId={projectId} />
                <JobHistorySection projectId={projectId} />
            </div>
        </div>
    );
}

export { FilesOverviewTab };
