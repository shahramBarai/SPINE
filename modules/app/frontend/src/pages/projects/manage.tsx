import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { MembersTab } from "components/feature/projectManage/MembersTab";
import { FilesTab } from "components/feature/projectManage/FilesTab";

type ManageTab = "members" | "files";

const TABS: { id: ManageTab; label: string }[] = [
    { id: "members", label: "Members" },
    { id: "files", label: "Files" }
];

const ProjectManagePage = () => {
    const { projectId } = useParams<{ projectId?: string }>();
    const navigate = useNavigate();
    const [tab, setTab] = useState<ManageTab>("members");

    if (!projectId) {
        navigate("/404", { replace: true });
        return null;
    }

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

    if (isProjectLoading || isRoleLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center gap-2 text-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">
                    Loading project...
                </span>
            </div>
        );
    }

    const canManage = role === "OWNER" || role === "EDITOR";

    if (projectError || !project || roleError || !canManage) {
        navigate("/404", { replace: true });
        return null;
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-1">
                {project.name}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Manage members, files, and semantic graphs for this project.
            </p>

            <div className="flex items-center gap-1 border-b border-border mb-6">
                {TABS.map((t) => (
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

            {tab === "members" ? (
                <MembersTab projectId={projectId} isOwner={role === "OWNER"} />
            ) : (
                <FilesTab projectId={projectId} />
            )}
        </div>
    );
};

export { ProjectManagePage };
