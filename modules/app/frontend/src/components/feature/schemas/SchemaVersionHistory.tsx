import { EyeIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import type { SchemaVersion } from "@server/clients/schemaRegistryClient";
import { Button } from "components/basics/Button";
import { Skeleton } from "components/basics/Skeleton";
import { downloadSchema } from "./downloadSchema";

interface SchemaVersionHistoryProps {
    versions: SchemaVersion[];
    selectedVersion: number | "latest";
    onVersionSelect: (version: number | "latest") => void;
    isLoading?: boolean;
}

function SchemaVersionHistory({
    versions,
    selectedVersion,
    onVersionSelect,
    isLoading
}: SchemaVersionHistoryProps) {
    if (isLoading) {
        return (
            <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-medium text-foreground">
                        Version History
                    </h3>
                </div>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
    const latestVersion = sortedVersions[0]?.version;

    return (
        <div className="bg-card rounded-lg border border-border">
            <div className="p-4 border-b border-border">
                <h3 className="text-lg font-medium text-foreground">
                    Version History
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                    {versions.length} version{versions.length !== 1 ? "s" : ""}{" "}
                    available
                </p>
            </div>

            <div className="divide-y divide-border">
                {sortedVersions.map((version) => {
                    const isSelected =
                        selectedVersion === version.version ||
                        (selectedVersion === "latest" &&
                            version.version === latestVersion);
                    const isLatest = version.version === latestVersion;

                    return (
                        <div
                            key={version.version}
                            className={`p-4 cursor-pointer transition-colors ${
                                isSelected
                                    ? "bg-primary/10 border-l-4 border-l-primary"
                                    : "hover:bg-muted"
                            }`}
                            onClick={() => onVersionSelect(version.version)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm font-medium text-foreground">
                                                v{version.version}
                                            </span>
                                            {isLatest && (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Latest
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            ID: {version.id}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onVersionSelect(version.version);
                                        }}
                                        className="text-xs"
                                    >
                                        <EyeIcon className="h-3 w-3 mr-1" />
                                        View
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadSchema(version);
                                        }}
                                        className="text-xs"
                                    >
                                        <ArrowDownTrayIcon className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            {isSelected && (
                                <div className="mt-3 pt-3 border-t border-border">
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="font-medium text-muted-foreground">
                                                Type:
                                            </span>
                                            <span className="ml-1 text-foreground">
                                                {version.schemaType}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-muted-foreground">
                                                Subject:
                                            </span>
                                            <span className="ml-1 text-foreground truncate">
                                                {version.subject}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {versions.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                    No versions found for this subject.
                </div>
            )}
        </div>
    );
}

export { SchemaVersionHistory };
