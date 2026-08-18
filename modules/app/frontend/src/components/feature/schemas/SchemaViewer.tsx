import { useState } from "react";
import {
    ClipboardDocumentIcon,
    ArrowDownTrayIcon,
    CheckIcon,
    DocumentTextIcon
} from "@heroicons/react/24/outline";
import type { SchemaVersion } from "@server/clients/schemaRegistryClient";
import { Button } from "components/basics/Button";
import { Skeleton } from "components/basics/Skeleton";
import { downloadSchema } from "./downloadSchema";

interface SchemaViewerProps {
    schema?: SchemaVersion;
    isLoading?: boolean;
}

/** Pretty-prints JSON-shaped schemas, leaving anything else (Protobuf) alone. */
function formatSchema(schema: string): string {
    try {
        return JSON.stringify(JSON.parse(schema), null, 2);
    } catch {
        return schema;
    }
}

function SchemaViewer({ schema, isLoading }: SchemaViewerProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!schema) return;

        try {
            await navigator.clipboard.writeText(schema.schema);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy to clipboard:", error);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-foreground">
                            Schema Definition
                        </h3>
                        <div className="flex space-x-2">
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-8 w-20" />
                        </div>
                    </div>
                </div>
                <div className="p-4">
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    if (!schema) {
        return (
            <div className="bg-card rounded-lg border border-border">
                <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-medium text-foreground">
                        Schema Definition
                    </h3>
                </div>
                <div className="p-6 text-center text-muted-foreground">
                    <DocumentTextIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p>Select a version to view the schema definition</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-lg border border-border">
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-foreground">
                            Schema Definition (v{schema.version})
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {schema.schemaType} schema for {schema.subject}
                        </p>
                    </div>
                    <div className="flex space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            className="flex items-center space-x-1"
                        >
                            {copied ? (
                                <>
                                    <CheckIcon className="h-4 w-4 text-green-600" />
                                    <span>Copied!</span>
                                </>
                            ) : (
                                <>
                                    <ClipboardDocumentIcon className="h-4 w-4" />
                                    <span>Copy</span>
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadSchema(schema)}
                            className="flex items-center space-x-1"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span>Download</span>
                        </Button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto border border-border">
                    <code className="language-json text-foreground">
                        {formatSchema(schema.schema)}
                    </code>
                </pre>
            </div>

            <div className="p-4 border-t border-border bg-muted">
                <h4 className="text-sm font-medium text-foreground mb-3">
                    Schema Metadata
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="font-medium text-muted-foreground">
                            Schema ID:
                        </span>
                        <span className="ml-2 text-foreground">
                            {schema.id}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium text-muted-foreground">
                            Version:
                        </span>
                        <span className="ml-2 text-foreground">
                            {schema.version}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium text-muted-foreground">
                            Type:
                        </span>
                        <span className="ml-2 text-foreground">
                            {schema.schemaType}
                        </span>
                    </div>
                </div>

                {schema.references && schema.references.length > 0 && (
                    <div className="mt-4">
                        <span className="font-medium text-muted-foreground block mb-2">
                            References:
                        </span>
                        <div className="bg-card rounded border border-border p-3 text-xs">
                            <pre className="text-foreground">
                                {JSON.stringify(schema.references, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export { SchemaViewer };
