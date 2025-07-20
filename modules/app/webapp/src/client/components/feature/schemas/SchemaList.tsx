import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/router";
import { SchemaSubject } from "@/server/schemas/schema-registry";
import { Skeleton } from "@/client/components/basics/Skeleton";

interface SchemaListProps {
  schemas: SchemaSubject[];
  isLoading?: boolean;
  error?: string;
}

export const SchemaList: React.FC<SchemaListProps> = ({
  schemas,
  isLoading,
  error,
}) => {
  const router = useRouter();

  const handleRowClick = (subject: string) => {
    void router.push(`/schemas/${encodeURIComponent(subject)}`);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Schema Subjects</h2>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Schema Subjects</h2>
        </div>
        <div className="p-6 text-center">
          <div className="text-red-600 mb-2">Error loading schemas</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">
          Schema Subjects ({schemas.length})
        </h2>
      </div>

      {schemas.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          No schemas found. Try adjusting your filters or register a new schema.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latest Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Compatibility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Versions
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {schemas.map((schema) => (
                <tr
                  key={schema.subject}
                  onClick={() => handleRowClick(schema.subject)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
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
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        schema.schemaType === "AVRO"
                          ? "bg-green-100 text-green-800"
                          : schema.schemaType === "JSON"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {schema.schemaType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        schema.compatibility === "FULL"
                          ? "bg-green-100 text-green-800"
                          : schema.compatibility === "BACKWARD"
                          ? "bg-blue-100 text-blue-800"
                          : schema.compatibility === "FORWARD"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {schema.compatibility}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {schema.versions.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};