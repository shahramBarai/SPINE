import { Loader2 } from "lucide-react";
import { api } from "utils/trpc";
import { SectionCard } from "components/complex/SectionCard";
import { CoverImageSection } from "./CoverImageSection";
import { ProjectDetailsSection } from "./ProjectDetailsSection";
import { ApiKeysSection } from "./ApiKeysSection";
import { MembersTab } from "./MembersSection";

function SettingsTab({ projectId }: { projectId: string }) {
    const {
        data: project,
        isLoading,
        error
    } = api.project.getProjectInfo.useQuery({ projectId });

    if (isLoading) {
        return (
            <SectionCard title="Settings" className="w-xl">
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading settings...
                </div>
            </SectionCard>
        );
    }

    if (error || !project) {
        return (
            <SectionCard title="Settings" className="w-xl">
                <p className="text-danger text-sm py-6">
                    Failed to load project settings.
                </p>
            </SectionCard>
        );
    }

    return (
        <div className="flex gap-3 w-full">
            <div className="w-2/5 flex flex-col gap-3">
                <CoverImageSection
                    projectId={projectId}
                    coverImageUrl={project.coverImageUrl}
                />
                <ProjectDetailsSection
                    projectId={projectId}
                    name={project.name}
                    description={project.description}
                    isPublic={project.isPublic}
                />
            </div>
            <div className="w-3/5 flex flex-col gap-3">
                <MembersTab projectId={project.id} isOwner={true} />
                <ApiKeysSection projectId={projectId} />
            </div>
        </div>
    );
}

export { SettingsTab };
