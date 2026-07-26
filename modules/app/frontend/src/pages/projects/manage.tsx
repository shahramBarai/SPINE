import { useState } from "react";
import { api } from "utils/trpc";
import { pageGuard } from "utils/pageGuard";
import { TabBar } from "components/complex/TabBar";
import { FilesOverviewTab } from "components/feature/projectManage/FilesOverviewTab";
import { SettingsTab } from "components/feature/projectManage/SettingsTab";
import { SemanticSearchSection } from "components/feature/projectManage/SemanticSearchSection";

type ManageTab = "files" | "semantic-search" | "settings";

const TABS: { id: ManageTab; label: string }[] = [
    { id: "files", label: "Files" },
    { id: "semantic-search", label: "Semantic Search" },
    { id: "settings", label: "Settings" }
];

interface ProjectManagePageProps {
    project: { id: string; name: string };
    role: "OWNER" | "EDITOR" | "VIEWER";
}

function ProjectManagePageContent({ project, role }: ProjectManagePageProps) {
    const [tab, setTab] = useState<ManageTab>("files");
    const isOwner = role === "OWNER";
    const visibleTabs = TABS.filter((t) => t.id !== "settings" || isOwner);

    return (
        <div className="p-6 max-w-5xl mx-auto pb-20">
            <h1 className="text-2xl font-bold text-foreground mb-1">
                {project.name}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Manage members, files, and semantic graphs for this project.
            </p>

            <TabBar
                className="mb-6"
                tabs={visibleTabs}
                active={tab}
                onChange={setTab}
            />

            <div className="flex flex-col items-center">
                {tab === "files" && <FilesOverviewTab projectId={project.id} />}
                {tab === "semantic-search" && (
                    <SemanticSearchSection projectId={project.id} />
                )}
                {tab === "settings" && isOwner && (
                    <SettingsTab projectId={project.id} />
                )}
            </div>
        </div>
    );
}

const ProjectManagePage = pageGuard(ProjectManagePageContent, {
    params: ["projectId"],
    handler: ({ projectId }) => {
        const {
            data: project,
            isLoading: isProjectLoading,
            error: projectError
        } = api.project.getProjectInfo.useQuery({ projectId });

        const {
            data: role,
            isLoading: isRoleLoading,
            error: roleError
        } = api.project.getMyRole.useQuery({ projectId });

        const canManage = role === "OWNER" || role === "EDITOR";

        return {
            isLoading: isProjectLoading || isRoleLoading,
            error: projectError || roleError,
            data: project && canManage ? { project, role } : undefined,
            loadingLabel: "Loading project..."
        };
    }
});

export { ProjectManagePage };
