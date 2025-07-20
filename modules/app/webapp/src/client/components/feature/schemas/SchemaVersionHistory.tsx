import { SchemaVersion } from "@/server/schemas/schema-registry";
import { Button } from "@/client/components/basics/Button";
import { Skeleton } from "@/client/components/basics/Skeleton";
import { EyeIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

interface SchemaVersionHistoryProps {
  versions: SchemaVersion[];
  selectedVersion: number | "latest";
  onVersionSelect: (version: number | "latest") => void;
  isLoading?: boolean;
}

export const SchemaVersionHistory: React.FC<SchemaVersionHistoryProps> = ({
  versions,
  selectedVersion,
  onVersionSelect,
  isLoading,
}) => {
  const handleVersionClick = (version: number) => {
    onVersionSelect(version);
  };

  const handleDownload = (version: SchemaVersion) => {
    const blob = new Blob([version.schema], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${version.subject}-v${version.version}.${version.schemaType.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Version History</h3>
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
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Version History</h3>
        <p className="text-sm text-gray-500 mt-1">
          {versions.length} version{versions.length !== 1 ? 's' : ''} available
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {sortedVersions.map((version) => {
          const isSelected = 
            selectedVersion === version.version || 
            (selectedVersion === "latest" && version.version === latestVersion);
          const isLatest = version.version === latestVersion;

          return (
            <div
              key={version.version}
              className={`p-4 cursor-pointer transition-colors ${
                isSelected 
                  ? "bg-blue-50 border-l-4 border-l-blue-500" 
                  : "hover:bg-gray-50"
              }`}
              onClick={() => handleVersionClick(version.version)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        v{version.version}
                      </span>
                      {isLatest && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Latest
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">ID: {version.id}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVersionClick(version.version);
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
                      handleDownload(version);
                    }}
                    className="text-xs"
                  >
                    <ArrowDownTrayIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {isSelected && (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-medium text-gray-500">Type:</span>
                      <span className="ml-1 text-gray-900">{version.schemaType}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Subject:</span>
                      <span className="ml-1 text-gray-900 truncate">{version.subject}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {versions.length === 0 && (
        <div className="p-6 text-center text-gray-500">
          No versions found for this subject.
        </div>
      )}
    </div>
  );
};