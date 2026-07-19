import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { Textarea } from "components/basics/textarea";
import { Label } from "components/basics/label";
import { Switch } from "components/basics/switch";
import { UploadFileButton } from "components/feature/twin/LeftSidebar/ProjectTreeSection/UploadFileButton";
import { MembersTab } from "./MembersTab";

const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

interface SettingsFormState {
    name: string;
    description: string;
    isPublic: boolean;
}

function SettingsTab({ projectId }: { projectId: string }) {
    const utils = api.useUtils();
    const {
        data: project,
        isLoading,
        error
    } = api.digitalTwin.getProject.useQuery({ projectId });

    // Local draft of the settings form - seeded from the server once, then
    // edited freely until Save persists it.
    const [form, setForm] = useState<SettingsFormState | null>(null);
    const [dirty, setDirty] = useState(false);
    const uploadedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (project && form === null) {
            setForm({
                name: project.name,
                description: project.description ?? "",
                isPublic: project.isPublic
            });
        }
    }, [project, form]);

    const updateSettings = api.project.updateSettings.useMutation({
        onSuccess: () => {
            utils.digitalTwin.getProject.invalidate({ projectId });
            utils.digitalTwin.getProjects.invalidate();
            setDirty(false);
            toast.success("Project settings saved.");
        },
        onError: (err) => toast.error(err.message)
    });

    const getCoverUploadUrl = api.project.getCoverUploadUrl.useMutation();

    const setCoverImage = api.project.setCoverImage.useMutation({
        onSuccess: () => {
            utils.digitalTwin.getProject.invalidate({ projectId });
            utils.digitalTwin.getProjects.invalidate();
            toast.success("Cover image updated.");
        },
        onError: (err) => toast.error(err.message)
    });

    const removeCoverImage = api.project.removeCoverImage.useMutation({
        onSuccess: () => {
            utils.digitalTwin.getProject.invalidate({ projectId });
            utils.digitalTwin.getProjects.invalidate();
            toast.success("Cover image removed.");
        },
        onError: (err) => toast.error(err.message)
    });

    if (isLoading || form === null) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading settings...
            </div>
        );
    }

    if (error || !project) {
        return (
            <p className="text-danger text-sm py-6">
                Failed to load project settings.
            </p>
        );
    }

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
        <div className="w-xl flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <Label>Cover image</Label>
                <div className="relative h-40 w-full max-w-sm rounded-lg overflow-hidden border border-border bg-muted">
                    {project.coverImageUrl ? (
                        <img
                            src={project.coverImageUrl}
                            alt="Project cover"
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                    )}

                    {removeCoverImage.isPending || setCoverImage.isPending ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1">
                            <UploadFileButton
                                allowedFileTypes={ALLOWED_IMAGE_EXTENSIONS}
                                maxFileSizeMB={10}
                                getUploadUrlString={async (fileName) => {
                                    const { uploadUrl, objectKey } =
                                        await getCoverUploadUrl.mutateAsync({
                                            projectId,
                                            fileName
                                        });
                                    uploadedKeyRef.current = objectKey;
                                    return uploadUrl;
                                }}
                                onUploadSuccess={() => {
                                    if (!uploadedKeyRef.current) return;
                                    setCoverImage.mutate({
                                        projectId,
                                        objectKey: uploadedKeyRef.current
                                    });
                                }}
                            />
                            {project.coverImageUrl && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Remove cover image"
                                    onClick={() =>
                                        removeCoverImage.mutate({ projectId })
                                    }
                                >
                                    <X className="h-4 w-4 text-danger" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                    id="project-name"
                    value={form.name}
                    onChange={(e) => {
                        setForm({ ...form, name: e.target.value });
                        setDirty(true);
                    }}
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                    id="project-description"
                    rows={4}
                    value={form.description}
                    onChange={(e) => {
                        setForm({ ...form, description: e.target.value });
                        setDirty(true);
                    }}
                />
            </div>

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
                    onCheckedChange={(checked) => {
                        setForm({ ...form, isPublic: checked });
                        setDirty(true);
                    }}
                />
            </div>

            <MembersTab projectId={project.id} isOwner={true} />

            {dirty && (
                <div className="flex justify-end">
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

export { SettingsTab };
