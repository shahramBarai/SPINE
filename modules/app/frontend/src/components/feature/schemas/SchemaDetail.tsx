import {
    CalendarIcon,
    TagIcon,
    ShieldCheckIcon
} from "@heroicons/react/24/outline";
import type { SchemaVersion } from "@server/clients/schemaRegistryClient";

interface SchemaDetailProps {
    schema: SchemaVersion;
    versions: SchemaVersion[];
}

function Stat({
    icon,
    label,
    children
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">{icon}</div>
            <div>
                <p className="text-sm font-medium text-muted-foreground">
                    {label}
                </p>
                {children}
            </div>
        </div>
    );
}

function SchemaDetail({ schema, versions }: SchemaDetailProps) {
    const latestVersion = Math.max(...versions.map((v) => v.version));
    const isLatest = schema.version === latestVersion;

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Stat
                    icon={<TagIcon className="h-8 w-8 text-blue-500" />}
                    label="Current Version"
                >
                    <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold text-foreground">
                            v{schema.version}
                        </p>
                        {isLatest && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Latest
                            </span>
                        )}
                    </div>
                </Stat>

                <Stat
                    icon={
                        <ShieldCheckIcon className="h-8 w-8 text-green-500" />
                    }
                    label="Schema Type"
                >
                    <p className="text-2xl font-bold text-foreground">
                        {schema.schemaType}
                    </p>
                </Stat>

                <Stat
                    icon={<CalendarIcon className="h-8 w-8 text-purple-500" />}
                    label="Total Versions"
                >
                    <p className="text-2xl font-bold text-foreground">
                        {versions.length}
                    </p>
                </Stat>

                <Stat
                    icon={
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-sm font-medium text-muted-foreground">
                                #
                            </span>
                        </div>
                    }
                    label="Schema ID"
                >
                    <p className="text-2xl font-bold text-foreground">
                        {schema.id}
                    </p>
                </Stat>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
                <h3 className="text-lg font-medium text-foreground mb-2">
                    Subject Information
                </h3>
                <div className="bg-muted rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">
                                Subject Name:
                            </span>
                            <span className="ml-2 text-sm text-foreground">
                                {schema.subject}
                            </span>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-muted-foreground">
                                Version:
                            </span>
                            <span className="ml-2 text-sm text-foreground">
                                {schema.version}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export { SchemaDetail };
