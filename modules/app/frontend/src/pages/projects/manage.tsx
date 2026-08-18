import { useState } from "react";
import { Link } from "react-router-dom";
import { Boxes } from "lucide-react";
import { api } from "utils/trpc";
import { pageGuard } from "utils/pageGuard";
import { Button } from "components/basics/Button";
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
    project: { id: string; name: string; isTwinEnabled: boolean };
    role: "OWNER" | "EDITOR" | "VIEWER";
}

function ProjectManagePageContent({ project, role }: ProjectManagePageProps) {
    const [tab, setTab] = useState<ManageTab>("files");
    const isOwner = role === "OWNER";
    const visibleTabs = TABS.filter((t) => t.id !== "settings" || isOwner);

    return (
        <div className="p-6 max-w-5xl mx-auto pb-20">
            <div className="flex items-start justify-between gap-4 mb-1">
                <h1 className="text-2xl font-bold text-foreground">
                    {project.name}
                </h1>
                {/* Members can always open the twin, draft or not - the
                    badge just flags that it isn't public yet. */}
                <Link
                    to={`/projects/${project.id}/digital-twin`}
                    className="shrink-0"
                >
                    <Button variant="outline" size="sm">
                        <Boxes className="h-4 w-4" />
                        Open Digital Twin
                        {!project.isTwinEnabled && (
                            <span className="ml-1 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                Draft
                            </span>
                        )}
                    </Button>
                </Link>
            </div>
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
        } = api.project.settingsTab.getProjectInfo.useQuery({ projectId });

        const {
            data: role,
            isLoading: isRoleLoading,
            error: roleError
        } = api.project.settingsTab.getMyRole.useQuery({ projectId });

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
