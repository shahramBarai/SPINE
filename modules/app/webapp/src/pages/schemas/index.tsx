import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";
import { api } from "@/utils/trpc";
import { Button } from "@/client/components/basics/Button";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import {
  SchemaList,
  SchemaRegistrationModal,
  SchemaFilters,
} from "@/client/components/feature/schemas";
import { SchemaFilters as SchemaFiltersType } from "@/server/schemas/schema-registry";

const SchemaManagementPage = () => {
  const [filters, setFilters] = useState<SchemaFiltersType>({});
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);

  // Queries
  const utils = api.useUtils();
  const schemasQuery = api.schemaRegistry.listSubjects.useQuery(filters);
  const healthQuery = api.schemaRegistry.healthCheck.useQuery();

  const refreshData = async () => {
    void utils.schemaRegistry.invalidate();
  };

  const handleFiltersChange = (newFilters: SchemaFiltersType) => {
    setFilters(newFilters);
  };

  const handleRegistrationSuccess = () => {
    setIsRegistrationModalOpen(false);
    void refreshData();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Schema Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage Confluent Schema Registry schemas and compatibility
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
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Schema Registry Status
          </h2>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                healthQuery.data?.status === "connected"
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                healthQuery.data?.status === "connected"
                  ? "text-green-700"
                  : "text-red-700"
              }`}
            >
              {healthQuery.data?.status === "connected"
                ? "Connected"
                : "Disconnected"}
            </span>
          </div>
        </div>
        {healthQuery.data && "error" in healthQuery.data && (
          <p className="text-red-600 text-sm mt-2">{healthQuery.data.error}</p>
        )}
      </div>

      {/* Filters */}
      <SchemaFilters onFiltersChange={handleFiltersChange} />

      {/* Schema List */}
      <SchemaList
        schemas={schemasQuery.data || []}
        isLoading={schemasQuery.isLoading}
        error={schemasQuery.error?.message}
      />

      {/* Registration Modal */}
      <SchemaRegistrationModal
        isOpen={isRegistrationModalOpen}
        onClose={() => setIsRegistrationModalOpen(false)}
        onSuccess={handleRegistrationSuccess}
      />
    </div>
  );
};

SchemaManagementPage.getLayout = function getLayout(page: React.ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};

export default SchemaManagementPage;

export const getServerSideProps = withAuthSSR({
  handler: async (ctx) => {
    const user = ctx.req.session.data;

    return {
      props: {
        user,
      },
    };
  },
});
