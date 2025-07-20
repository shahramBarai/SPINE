import AppLayout from "@/client/layout/layout";
import { withAuthSSR } from "@/server/auth/authenticated-ssr";
import { api } from "@/utils/trpc";
import { Button } from "@/client/components/basics/Button";
import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  SchemaDetail,
  SchemaVersionHistory,
  SchemaViewer,
  SchemaActions,
} from "@/client/components/feature/schemas";

const SchemaDetailPage = () => {
  const router = useRouter();
  const subject = router.query.subject as string;
  const [selectedVersion, setSelectedVersion] = useState<number | "latest">("latest");

  // Queries
  const utils = api.useUtils();
  const versionsQuery = api.schemaRegistry.getSubjectVersions.useQuery(
    { subject },
    { enabled: !!subject }
  );
  const schemaQuery = api.schemaRegistry.getSchemaVersion.useQuery(
    { subject, version: selectedVersion },
    { enabled: !!subject }
  );

  const refreshData = async () => {
    void utils.schemaRegistry.invalidate();
  };

  const handleBackClick = () => {
    void router.push("/schemas");
  };

  const handleVersionSelect = (version: number | "latest") => {
    setSelectedVersion(version);
  };

  const handleDeleteSuccess = () => {
    void router.push("/schemas");
  };

  if (!subject) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBackClick}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to List
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{subject}</h1>
            <p className="text-gray-600 mt-1">Schema subject details and versions</p>
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

      {/* Schema Overview */}
      {schemaQuery.data && (
        <SchemaDetail
          schema={schemaQuery.data}
          versions={versionsQuery.data || []}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Version History */}
        <div className="lg:col-span-1">
          <SchemaVersionHistory
            versions={versionsQuery.data || []}
            selectedVersion={selectedVersion}
            onVersionSelect={handleVersionSelect}
            isLoading={versionsQuery.isLoading}
          />
        </div>

        {/* Schema Viewer */}
        <div className="lg:col-span-2">
          <SchemaViewer
            schema={schemaQuery.data}
            isLoading={schemaQuery.isLoading}
          />
        </div>
      </div>

      {/* Actions */}
      {schemaQuery.data && (
        <SchemaActions
          subject={subject}
          schema={schemaQuery.data}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
};

SchemaDetailPage.getLayout = function getLayout(page: React.ReactElement) {
  return <AppLayout>{page}</AppLayout>;
};

export default SchemaDetailPage;

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