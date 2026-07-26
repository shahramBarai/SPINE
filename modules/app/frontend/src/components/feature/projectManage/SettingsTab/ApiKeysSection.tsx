import { useState } from "react";
import { Copy, Key, Loader2, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { Modal } from "components/complex/Modal";
import { ConfirmModal } from "components/complex/ConfirmModal";
import { SectionCard } from "components/complex/SectionCard";

// `date` may arrive as an ISO string over the wire even though its static
// type says Date, since plain JSON (no superjson transformer here) can't
// carry Date instances - wrapping in `new Date(...)` normalizes either case.
function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(date));
}

function ApiKeysSection({
    projectId,
    className
}: {
    projectId: string;
    className?: string;
}) {
    const utils = api.useUtils();
    const {
        data: keys,
        isLoading,
        error
    } = api.project.listApiKeys.useQuery({ projectId });

    const [showNewKey, setShowNewKey] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [createdKey, setCreatedKey] = useState<{
        name: string;
        rawKey: string;
    } | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);

    const invalidateKeys = () =>
        utils.project.listApiKeys.invalidate({ projectId });

    const createKey = api.project.createApiKey.useMutation({
        onSuccess: (result) => {
            invalidateKeys();
            setShowNewKey(false);
            setNewKeyName("");
            setCreatedKey({ name: result.name, rawKey: result.rawKey });
        },
        onError: (err) => toast.error(err.message)
    });

    const revokeKey = api.project.revokeApiKey.useMutation({
        onSuccess: () => {
            invalidateKeys();
            setRevokeTarget(null);
            toast.success("API key revoked.");
        },
        onError: (err) => toast.error(err.message)
    });

    const handleCreate = () => {
        const name = newKeyName.trim();
        if (!name) {
            toast.warning("Enter a name for the key.");
            return;
        }
        createKey.mutate({ projectId, name });
    };

    const copyKey = async (value: string) => {
        await navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard.");
    };

    if (isLoading) {
        return (
            <SectionCard title="API Access" className={className}>
                <div className="flex items-center gap-2 text-muted-foreground py-6">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading API keys...
                </div>
            </SectionCard>
        );
    }

    if (error || !keys) {
        return (
            <SectionCard title="API Access" className={className}>
                <p className="text-danger text-sm py-6">
                    Failed to load API keys.
                </p>
            </SectionCard>
        );
    }

    return (
        <SectionCard title="API Access" className={className}>
            <p className="text-xs text-muted-foreground">
                API keys let external systems run read-only SPARQL queries
                against this project's dataset. Anyone with a key can query
                it - treat keys like passwords.
            </p>

            <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                {keys.map((key) => (
                    <div
                        key={key.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                    >
                        <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 flex flex-col min-w-0">
                            <span className="text-foreground truncate">
                                {key.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono truncate">
                                {key.keyPrefix}...{" "}
                                {key.lastUsedAt
                                    ? `· Last used ${formatDate(key.lastUsedAt)}`
                                    : "· Never used"}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Revoke key"
                            onClick={() =>
                                setRevokeTarget({ id: key.id, name: key.name })
                            }
                        >
                            <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                    </div>
                ))}

                {showNewKey ? (
                    <div className="flex items-center gap-2 px-3 py-2">
                        <Input
                            autoFocus
                            placeholder="Key name (e.g. CI pipeline)"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreate();
                                if (e.key === "Escape") {
                                    setShowNewKey(false);
                                    setNewKeyName("");
                                }
                            }}
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={createKey.isPending}
                            onClick={handleCreate}
                        >
                            Create
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowNewKey(false);
                                setNewKeyName("");
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowNewKey(true)}
                        className={cn(
                            "w-full py-2 text-center text-sm text-muted-foreground transition-colors",
                            "hover:cursor-pointer hover:text-primary hover:bg-muted"
                        )}
                    >
                        + New API key
                    </button>
                )}
            </div>

            {revokeTarget && (
                <ConfirmModal
                    title="Revoke API key"
                    description={`Are you sure you want to revoke "${revokeTarget.name}"? Any system using it will immediately lose access.`}
                    open={!!revokeTarget}
                    setOpen={(open) => {
                        if (!open) setRevokeTarget(null);
                    }}
                    isConfirming={revokeKey.isPending}
                    onConfirm={() =>
                        revokeKey.mutate({
                            projectId,
                            keyId: revokeTarget.id
                        })
                    }
                />
            )}

            {createdKey && (
                <Modal
                    title="API key created"
                    description={`Copy "${createdKey.name}"'s key now - it won't be shown again.`}
                    open={!!createdKey}
                    setOpen={(open) => {
                        if (!open) setCreatedKey(null);
                    }}
                >
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <code className="flex-1 min-w-0 truncate rounded-md border border-border bg-muted px-3 py-2 text-xs font-mono">
                                {createdKey.rawKey}
                            </code>
                            <Button
                                variant="outline"
                                size="icon"
                                title="Copy"
                                onClick={() => copyKey(createdKey.rawKey)}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => setCreatedKey(null)}
                        >
                            Done
                        </Button>
                    </div>
                </Modal>
            )}
        </SectionCard>
    );
}

export { ApiKeysSection };
