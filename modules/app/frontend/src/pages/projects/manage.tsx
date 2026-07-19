import { useState } from "react";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { pageGuard } from "utils/pageGuard";
import { MembersTab } from "components/feature/projectManage/MembersTab";
import { FilesTab } from "components/feature/projectManage/FilesTab";
import { SettingsTab } from "components/feature/projectManage/SettingsTab";

type ManageTab = "members" | "files" | "settings";

const TABS: { id: ManageTab; label: string }[] = [
    { id: "members", label: "Members" },
    { id: "files", label: "Files" },
    { id: "settings", label: "Settings" }
];

interface ProjectManagePageProps {
    project: { id: string; name: string };
    role: "OWNER" | "EDITOR" | "VIEWER";
}

function ProjectManagePageContent({ project, role }: ProjectManagePageProps) {
    const [tab, setTab] = useState<ManageTab>("members");
    const isOwner = role === "OWNER";
    const visibleTabs = TABS.filter((t) => t.id !== "settings" || isOwner);

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-1">
                {project.name}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Manage members, files, and semantic graphs for this project.
            </p>

            <div className="flex items-center gap-1 border-b border-border mb-6">
                {visibleTabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                            tab === t.id
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "members" && (
                <MembersTab projectId={project.id} isOwner={isOwner} />
            )}
            {tab === "files" && <FilesTab projectId={project.id} />}
            {tab === "settings" && isOwner && (
                <SettingsTab projectId={project.id} />
            )}
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
        } = api.digitalTwin.getProject.useQuery({ projectId });

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
