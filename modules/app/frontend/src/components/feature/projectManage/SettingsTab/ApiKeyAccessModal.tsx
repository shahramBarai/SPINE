import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Network } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { Switch } from "components/basics/switch";
import { CheckButton } from "components/basics/CheckBox";
import { Modal } from "components/complex/Modal";

interface ApiKeyAccessModalProps {
    projectId: string;
    apiKey: {
        id: string;
        name: string;
        canReadGraph: boolean;
        expiresAt: Date | string | null;
    };
    open: boolean;
    setOpen: (open: boolean) => void;
}

/**
 * Formats a date for an `<input type="date">`, which only accepts
 * `YYYY-MM-DD`. Returns an empty string for a key that never expires.
 */
function toDateInputValue(value: Date | string | null): string {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/**
 * Editor for a single API key's scope: whether it may read the project's
 * graph, which of the project's files it may download, and when it expires.
 * Selections are saved as one desired state rather than per-toggle, so
 * closing without saving leaves the key untouched.
 */
function ApiKeyAccessModal({
    projectId,
    apiKey,
    open,
    setOpen
}: ApiKeyAccessModalProps) {
    const utils = api.useUtils();

    const { data: fileGroups, isLoading: isLoadingFiles } =
        api.project.files.listFiles.useQuery({ projectId }, { enabled: open });
    const { data: grantedFiles, isLoading: isLoadingGrants } =
        api.project.settingsTab.listApiKeyFiles.useQuery(
            { projectId, keyId: apiKey.id },
            { enabled: open }
        );

    const [canReadGraph, setCanReadGraph] = useState(apiKey.canReadGraph);
    const [expiresAt, setExpiresAt] = useState(
        toDateInputValue(apiKey.expiresAt)
    );
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(
        new Set()
    );

    useEffect(() => {
        if (open) {
            setCanReadGraph(apiKey.canReadGraph);
            setExpiresAt(toDateInputValue(apiKey.expiresAt));
        }
    }, [open, apiKey.canReadGraph, apiKey.expiresAt]);

    useEffect(() => {
        if (grantedFiles) {
            setSelectedFileIds(new Set(grantedFiles.map((file) => file.id)));
        }
    }, [grantedFiles]);

    const files = useMemo(
        () =>
            (fileGroups ?? []).flatMap((group) =>
                group.files.map((file) => ({
                    ...file,
                    folder: group.folder
                }))
            ),
        [fileGroups]
    );

    const updateAccess =
        api.project.settingsTab.updateApiKeyAccess.useMutation();
    const setFiles = api.project.settingsTab.setApiKeyFiles.useMutation();

    const isSaving = updateAccess.isPending || setFiles.isPending;
    const isLoading = isLoadingFiles || isLoadingGrants;

    const toggleFile = (fileId: string) => {
        setSelectedFileIds((previous) => {
            const next = new Set(previous);
            if (next.has(fileId)) {
                next.delete(fileId);
            } else {
                next.add(fileId);
            }
            return next;
        });
    };

    const handleSave = async () => {
        try {
            await updateAccess.mutateAsync({
                projectId,
                keyId: apiKey.id,
                canReadGraph,
                expiresAt: expiresAt === "" ? null : expiresAt
            });
            await setFiles.mutateAsync({
                projectId,
                keyId: apiKey.id,
                fileIds: Array.from(selectedFileIds)
            });

            await Promise.all([
                utils.project.settingsTab.listApiKeys.invalidate({ projectId }),
                utils.project.settingsTab.listApiKeyFiles.invalidate({
                    projectId,
                    keyId: apiKey.id
                })
            ]);

            toast.success(`Access updated for "${apiKey.name}".`);
            setOpen(false);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to update access."
            );
        }
    };

    return (
        <Modal
            title={`Access for "${apiKey.name}"`}
            description="Choose what external systems using this key may read. A key grants nothing until something is selected here."
            open={open}
            setOpen={setOpen}
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                    <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">Graph access</p>
                        <p className="text-xs text-muted-foreground">
                            Run read-only SPARQL queries against this project's
                            dataset.
                        </p>
                    </div>
                    <Switch
                        checked={canReadGraph}
                        onCheckedChange={setCanReadGraph}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="api-key-expiry"
                        className="text-sm text-foreground"
                    >
                        Expires on
                    </label>
                    <Input
                        id="api-key-expiry"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        Leave empty for a key that never expires.
                    </p>
                </div>

                <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-foreground">
                        File access
                        <span className="text-muted-foreground">
                            {" "}
                            · {selectedFileIds.size} selected
                        </span>
                    </p>

                    {isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading files...
                        </div>
                    ) : files.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4">
                            This project has no files to grant access to yet.
                        </p>
                    ) : (
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                            {files.map((file) => (
                                <div
                                    key={file.fileId}
                                    onClick={() => toggleFile(file.fileId)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted transition-colors hover:cursor-pointer"
                                >
                                    <CheckButton
                                        checked={selectedFileIds.has(
                                            file.fileId
                                        )}
                                        onClick={() => toggleFile(file.fileId)}
                                    />
                                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="flex-1 min-w-0 truncate text-sm text-foreground">
                                        {file.fileName}
                                    </span>
                                    {file.folder && (
                                        <span className="text-xs text-muted-foreground truncate">
                                            {file.folder}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={isSaving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={isSaving || isLoading}
                    >
                        {isSaving ? "Saving..." : "Save access"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export { ApiKeyAccessModal };
