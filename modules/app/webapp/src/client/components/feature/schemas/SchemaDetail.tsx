import { SchemaVersion } from "@/server/schemas/schema-registry";
import { CalendarIcon, TagIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

interface SchemaDetailProps {
  schema: SchemaVersion;
  versions: SchemaVersion[];
}

export const SchemaDetail: React.FC<SchemaDetailProps> = ({
  schema,
  versions,
}) => {
  const latestVersion = versions.find(v => v.version === Math.max(...versions.map(v => v.version)));
  const isLatest = schema.version === latestVersion?.version;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current Version */}
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <TagIcon className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Current Version</p>
            <div className="flex items-center space-x-2">
              <p className="text-2xl font-bold text-gray-900">v{schema.version}</p>
              {isLatest && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Latest
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Schema Type */}
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <ShieldCheckIcon className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Schema Type</p>
            <p className="text-2xl font-bold text-gray-900">{schema.schemaType}</p>
          </div>
        </div>

        {/* Total Versions */}
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <CalendarIcon className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Versions</p>
            <p className="text-2xl font-bold text-gray-900">{versions.length}</p>
          </div>
        </div>

        {/* Schema ID */}
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-sm font-medium text-gray-500">#</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Schema ID</p>
            <p className="text-2xl font-bold text-gray-900">{schema.id}</p>
          </div>
        </div>
      </div>

      {/* Subject Info */}
      <div className="mt-6 pt-6 border-t">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Subject Information</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Subject Name:</span>
              <span className="ml-2 text-sm text-gray-900">{schema.subject}</span>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Version:</span>
              <span className="ml-2 text-sm text-gray-900">{schema.version}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};