import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import type { SchemaSubject } from "@server/clients/schemaRegistryClient";
import { Skeleton } from "components/basics/Skeleton";

interface SchemaListProps {
    schemas: SchemaSubject[];
    isLoading?: boolean;
    error?: string;
}

const TYPE_BADGE: Record<SchemaSubject["schemaType"], string> = {
    AVRO: "bg-green-100 text-green-800",
    JSON: "bg-yellow-100 text-yellow-800",
    PROTOBUF: "bg-purple-100 text-purple-800"
};

function compatibilityBadge(
    compatibility: SchemaSubject["compatibility"]
): string {
    switch (compatibility) {
        case "FULL":
            return "bg-green-100 text-green-800";
        case "BACKWARD":
            return "bg-blue-100 text-blue-800";
        case "FORWARD":
            return "bg-yellow-100 text-yellow-800";
        default:
            return "bg-gray-100 text-gray-800";
    }
}

function SchemaListShell({
    children,
    title
}: {
    children: React.ReactNode;
    title: string;
}) {
    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
                <h2 className="text-xl font-semibold text-foreground">
                    {title}
                </h2>
            </div>
            {children}
        </div>
    );
}

function SchemaList({ schemas, isLoading, error }: SchemaListProps) {
    const navigate = useNavigate();

    const handleRowClick = (subject: string) => {
        void navigate(`/admin/schemas/${encodeURIComponent(subject)}`);
    };

    if (isLoading) {
        return (
            <SchemaListShell title="Schema Subjects">
                <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <Skeleton key={index} className="h-16 w-full" />
                    ))}
                </div>
            </SchemaListShell>
        );
    }

    if (error) {
        return (
            <SchemaListShell title="Schema Subjects">
                <div className="p-6 text-center">
                    <div className="text-danger mb-2">
                        Error loading schemas
                    </div>
                    <div className="text-muted-foreground text-sm">{error}</div>
                </div>
            </SchemaListShell>
        );
    }

    return (
        <SchemaListShell title={`Schema Subjects (${schemas.length})`}>
            {schemas.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                    No schemas found. Try adjusting your filters or register a
                    new schema.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted">
                            <tr>
                                {[
                                    "Subject",
                                    "Latest Version",
                                    "Type",
                                    "Compatibility",
                                    "Versions"
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                                    >
                                        {heading}
                                    </th>
                                ))}
                                <th className="relative px-6 py-3">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {schemas.map((schema) => (
                                <tr
                                    key={schema.subject}
                                    onClick={() =>
                                        handleRowClick(schema.subject)
                                    }
                                    className="hover:bg-muted cursor-pointer transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-foreground">
                                            {schema.subject}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            v{schema.latestVersion}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[schema.schemaType]}`}
                                        >
                                            {schema.schemaType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${compatibilityBadge(schema.compatibility)}`}
                                        >
                                            {schema.compatibility}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        {schema.versions.length}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <ChevronRightIcon className="h-5 w-5 text-muted-foreground" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SchemaListShell>
    );
}

export { SchemaList };
