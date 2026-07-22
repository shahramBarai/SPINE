import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { Textarea } from "components/basics/textarea";
import { Switch } from "components/basics/switch";
import { SectionCard } from "components/complex/SectionCard";
import { cn } from "utils/index";

interface SettingsFormState {
    name: string;
    description: string;
    isPublic: boolean;
}

function ProjectDetailsSection({
    projectId,
    name,
    description,
    isPublic,
    className
}: {
    projectId: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    className?: string;
}) {
    const utils = api.useUtils();

    // Local draft of the form - seeded from the server once, then edited
    // freely until Save persists it.
    const originalForm: SettingsFormState = {
        name,
        description: description ?? "",
        isPublic
    };
    const [form, setForm] = useState<SettingsFormState>(originalForm);

    useEffect(() => {
        setForm({ name, description: description ?? "", isPublic });
    }, [name, description, isPublic]);

    // Derived (not tracked in state) so the button hides itself the moment
    // the fields are edited back to match the server's values, the same way
    // MembersTab's row-level dirty checks do.
    const dirty =
        form.name !== originalForm.name ||
        form.description !== originalForm.description ||
        form.isPublic !== originalForm.isPublic;

    const updateSettings = api.project.updateSettings.useMutation({
        onSuccess: () => {
            utils.project.getProjectInfo.invalidate({ projectId });
            utils.digitalTwin.getProjects.invalidate();
            toast.success("Project settings saved.");
        },
        onError: (err) => toast.error(err.message)
    });

    const handleReset = () => setForm(originalForm);

    const handleSave = () => {
        if (!form.name.trim()) {
            toast.warning("Project name cannot be empty.");
            return;
        }

        updateSettings.mutate({
            projectId,
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            isPublic: form.isPublic
        });
    };

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <SectionCard title="Name" className="gap-1!">
                <Input
                    id="project-name"
                    value={form.name}
                    onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                    }
                />
            </SectionCard>

            <SectionCard title="Description" className="gap-1!">
                <Textarea
                    id="project-description"
                    rows={4}
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />
            </SectionCard>

            <div className="flex items-center justify-between gap-2 border border-border rounded-md px-4 py-3">
                <div>
                    <p className="text-sm font-medium text-foreground">
                        Public project
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Anyone can view a public project. Only members can view
                        a private one.
                    </p>
                </div>
                <Switch
                    checked={form.isPublic}
                    onCheckedChange={(checked) =>
                        setForm({ ...form, isPublic: checked })
                    }
                />
            </div>

            {dirty && (
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        disabled={updateSettings.isPending}
                        onClick={handleReset}
                    >
                        Reset
                    </Button>
                    <Button
                        variant="primary"
                        disabled={updateSettings.isPending}
                        onClick={handleSave}
                    >
                        {updateSettings.isPending
                            ? "Saving..."
                            : "Save changes"}
                    </Button>
                </div>
            )}
        </div>
    );
}

export { ProjectDetailsSection };
