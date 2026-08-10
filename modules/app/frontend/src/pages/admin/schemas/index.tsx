import { useState } from "react";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { SchemaFilters as SchemaFiltersType } from "@server/clients/schemaRegistryClient";
import { api } from "utils/trpc";
import { adminGuard } from "utils/adminGuard";
import { Button } from "components/basics/Button";
import {
    SchemaList,
    SchemaRegistrationModal,
    SchemaFilters
} from "components/feature/schemas";

function SchemaManagementPageContent() {
    const [filters, setFilters] = useState<SchemaFiltersType>({});
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] =
        useState(false);

    const utils = api.useUtils();
    const schemasQuery = api.schemaRegistry.listSubjects.useQuery(filters);
    const healthQuery = api.schemaRegistry.healthCheck.useQuery();

    const isConnected = healthQuery.data?.status === "connected";

    const refreshData = () => {
        void utils.schemaRegistry.invalidate();
    };

    const handleRegistrationSuccess = () => {
        setIsRegistrationModalOpen(false);
        refreshData();
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">
                        Schema Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage Confluent Schema Registry schemas and
                        compatibility
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={refreshData}
                        variant="outline"
                        className="flex items-center gap-2"
                        disabled={schemasQuery.isLoading}
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Refresh
                    </Button>
                    <Button
                        onClick={() => setIsRegistrationModalOpen(true)}
                        className="flex items-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Register Schema
                    </Button>
                </div>
            </div>

            {/* Health Status */}
            <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                        Schema Registry Status
                    </h2>
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <span
                            className={`text-sm font-medium ${isConnected ? "text-green-700" : "text-red-700"}`}
                        >
                            {isConnected ? "Connected" : "Disconnected"}
                        </span>
                    </div>
                </div>
                {healthQuery.data && "error" in healthQuery.data && (
                    <p className="text-danger text-sm mt-2">
                        {healthQuery.data.error}
                    </p>
                )}
            </div>

            <SchemaFilters onFiltersChange={setFilters} />

            <SchemaList
                schemas={schemasQuery.data || []}
                isLoading={schemasQuery.isLoading}
                error={schemasQuery.error?.message}
            />

            <SchemaRegistrationModal
                isOpen={isRegistrationModalOpen}
                onClose={() => setIsRegistrationModalOpen(false)}
                onSuccess={handleRegistrationSuccess}
            />
        </div>
    );
}

const SchemaManagementPage = adminGuard(SchemaManagementPageContent);

export { SchemaManagementPage };
