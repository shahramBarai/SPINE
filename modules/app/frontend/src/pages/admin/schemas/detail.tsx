import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { api } from "utils/trpc";
import { adminGuard } from "utils/adminGuard";
import { pageGuard } from "utils/pageGuard";
import { Button } from "components/basics/Button";
import {
    SchemaDetail,
    SchemaVersionHistory,
    SchemaViewer,
    SchemaActions
} from "components/feature/schemas";

const SCHEMAS_PATH = "/admin/schemas";

function SchemaDetailPageContent({ subject }: { subject: string }) {
    const navigate = useNavigate();
    const [selectedVersion, setSelectedVersion] = useState<number | "latest">(
        "latest"
    );

    const utils = api.useUtils();
    const versionsQuery = api.schemaRegistry.getSubjectVersions.useQuery({
        subject
    });
    const schemaQuery = api.schemaRegistry.getSchemaVersion.useQuery({
        subject,
        version: selectedVersion
    });

    const refreshData = () => {
        void utils.schemaRegistry.invalidate();
    };

    const goToList = () => {
        void navigate(SCHEMAS_PATH);
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button
                        onClick={goToList}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        Back to List
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">
                            {subject}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Schema subject details and versions
                        </p>
                    </div>
                </div>
                <Button
                    onClick={refreshData}
                    variant="outline"
                    className="flex items-center gap-2"
                    disabled={versionsQuery.isLoading || schemaQuery.isLoading}
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Refresh
                </Button>
            </div>

            {schemaQuery.data && (
                <SchemaDetail
                    schema={schemaQuery.data}
                    versions={versionsQuery.data || []}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <SchemaVersionHistory
                        versions={versionsQuery.data || []}
                        selectedVersion={selectedVersion}
                        onVersionSelect={setSelectedVersion}
                        isLoading={versionsQuery.isLoading}
                    />
                </div>

                <div className="lg:col-span-2">
                    <SchemaViewer
                        schema={schemaQuery.data}
                        isLoading={schemaQuery.isLoading}
                    />
                </div>
            </div>

            {schemaQuery.data && (
                <SchemaActions subject={subject} onDeleteSuccess={goToList} />
            )}
        </div>
    );
}

// The subject has to be in the URL for any of the queries to make sense, so a
// missing param goes to /404 before the page renders. The schema data itself
// is not resolved here - each section shows its own loading state, the way
// the page did under Next.js.
const SchemaDetailPage = adminGuard(
    pageGuard(SchemaDetailPageContent, {
        params: ["subject"],
        handler: ({ subject }) => ({ data: { subject } })
    })
);

export { SchemaDetailPage };
