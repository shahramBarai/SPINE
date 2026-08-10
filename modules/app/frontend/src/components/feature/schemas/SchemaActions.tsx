import { useState } from "react";
import {
    ShieldCheckIcon,
    TrashIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import type { CompatibilityLevel } from "@server/clients/schemaRegistryClient";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";

interface SchemaActionsProps {
    subject: string;
    onDeleteSuccess?: () => void;
}

const COMPATIBILITY_LEVELS: CompatibilityLevel[] = [
    "NONE",
    "BACKWARD",
    "FORWARD",
    "FULL",
    "BACKWARD_TRANSITIVE",
    "FORWARD_TRANSITIVE",
    "FULL_TRANSITIVE"
];

function SchemaActions({ subject, onDeleteSuccess }: SchemaActionsProps) {
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [selectedCompatibility, setSelectedCompatibility] =
        useState<CompatibilityLevel>("BACKWARD");

    const utils = api.useUtils();

    const updateCompatibilityMutation =
        api.schemaRegistry.updateCompatibility.useMutation({
            onSuccess: () => {
                void utils.schemaRegistry.invalidate();
            }
        });

    const deleteSubjectMutation = api.schemaRegistry.deleteSubject.useMutation({
        onSuccess: () => {
            void utils.schemaRegistry.invalidate();
            onDeleteSuccess?.();
        }
    });

    const handleUpdateCompatibility = () => {
        updateCompatibilityMutation.mutate({
            subject,
            compatibility: selectedCompatibility
        });
    };

    const handleDelete = (permanent: boolean) => {
        deleteSubjectMutation.mutate(
            { subject, permanent },
            { onSuccess: () => setIsDeleteConfirmOpen(false) }
        );
    };

    return (
        <div className="bg-card rounded-lg border border-border">
            <div className="p-4 border-b border-border">
                <h3 className="text-lg font-medium text-foreground">
                    Schema Actions
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage compatibility settings and schema lifecycle
                </p>
            </div>

            <div className="p-6 space-y-6">
                {/* Compatibility Management */}
                <div>
                    <div className="flex items-center space-x-2 mb-3">
                        <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
                        <h4 className="text-md font-medium text-foreground">
                            Update Compatibility Level
                        </h4>
                    </div>

                    <div className="flex items-center space-x-3">
                        <Select
                            value={selectedCompatibility}
                            onValueChange={(value) =>
                                setSelectedCompatibility(
                                    value as CompatibilityLevel
                                )
                            }
                        >
                            <SelectTrigger className="flex-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COMPATIBILITY_LEVELS.map((level) => (
                                    <SelectItem key={level} value={level}>
                                        {level}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button
                            onClick={handleUpdateCompatibility}
                            disabled={updateCompatibilityMutation.isPending}
                            className="whitespace-nowrap"
                        >
                            {updateCompatibilityMutation.isPending
                                ? "Updating..."
                                : "Update"}
                        </Button>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                        Current compatibility level affects how schema evolution
                        is validated.
                    </p>
                </div>

                {/* Delete Schema */}
                <div className="border-t border-border pt-6">
                    <div className="flex items-center space-x-2 mb-3">
                        <TrashIcon className="h-5 w-5 text-danger" />
                        <h4 className="text-md font-medium text-foreground">
                            Delete Schema Subject
                        </h4>
                    </div>

                    {!isDeleteConfirmOpen ? (
                        <div>
                            <Button
                                variant="danger"
                                onClick={() => setIsDeleteConfirmOpen(true)}
                            >
                                Delete Subject
                            </Button>
                            <p className="mt-2 text-xs text-muted-foreground">
                                This will soft delete the subject. It can be
                                restored later.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-danger-light border border-danger rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <ExclamationTriangleIcon className="h-5 w-5 text-danger mt-0.5" />
                                <div className="flex-1">
                                    <h5 className="text-sm font-medium text-danger-light-foreground">
                                        Confirm Deletion
                                    </h5>
                                    <p className="text-sm text-danger-light-foreground mt-1">
                                        Are you sure you want to delete the
                                        subject &quot;{subject}&quot;? This
                                        action will remove all versions of this
                                        schema.
                                    </p>

                                    <div className="mt-4 flex space-x-3">
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => handleDelete(false)}
                                            disabled={
                                                deleteSubjectMutation.isPending
                                            }
                                        >
                                            {deleteSubjectMutation.isPending
                                                ? "Deleting..."
                                                : "Soft Delete"}
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDelete(true)}
                                            disabled={
                                                deleteSubjectMutation.isPending
                                            }
                                        >
                                            Permanent Delete
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setIsDeleteConfirmOpen(false)
                                            }
                                            disabled={
                                                deleteSubjectMutation.isPending
                                            }
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Display */}
            {(updateCompatibilityMutation.error ||
                deleteSubjectMutation.error) && (
                <div className="p-4 border-t border-border bg-danger-light">
                    <div className="text-danger-light-foreground text-sm">
                        <strong>Error:</strong>{" "}
                        {updateCompatibilityMutation.error?.message ||
                            deleteSubjectMutation.error?.message}
                    </div>
                </div>
            )}
        </div>
    );
}

export { SchemaActions };
