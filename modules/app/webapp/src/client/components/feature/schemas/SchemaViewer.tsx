import { useState } from "react";
import { SchemaVersion } from "@/server/schemas/schema-registry";
import { Button } from "@/client/components/basics/Button";
import { Skeleton } from "@/client/components/basics/Skeleton";
import { 
  ClipboardDocumentIcon, 
  ArrowDownTrayIcon,
  CheckIcon,
  DocumentTextIcon 
} from "@heroicons/react/24/outline";

interface SchemaViewerProps {
  schema?: SchemaVersion;
  isLoading?: boolean;
}

export const SchemaViewer: React.FC<SchemaViewerProps> = ({
  schema,
  isLoading,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!schema) return;
    
    try {
      await navigator.clipboard.writeText(schema.schema);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDownload = () => {
    if (!schema) return;

    const blob = new Blob([schema.schema], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.subject}-v${schema.version}.${schema.schemaType.toLowerCase()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatSchema = (schemaStr: string): string => {
    try {
      const parsed = JSON.parse(schemaStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return schemaStr;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Schema Definition</h3>
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
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Schema Definition</h3>
        </div>
        <div className="p-6 text-center text-gray-500">
          <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p>Select a version to view the schema definition</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Schema Definition (v{schema.version})
            </h3>
            <p className="text-sm text-gray-500 mt-1">
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
              onClick={handleDownload}
              className="flex items-center space-x-1"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>Download</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="relative">
          <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto border">
            <code className="language-json text-gray-900">
              {formatSchema(schema.schema)}
            </code>
          </pre>
        </div>
      </div>

      {/* Schema Metadata */}
      <div className="p-4 border-t bg-gray-50">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Schema Metadata</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-500">Schema ID:</span>
            <span className="ml-2 text-gray-900">{schema.id}</span>
          </div>
          <div>
            <span className="font-medium text-gray-500">Version:</span>
            <span className="ml-2 text-gray-900">{schema.version}</span>
          </div>
          <div>
            <span className="font-medium text-gray-500">Type:</span>
            <span className="ml-2 text-gray-900">{schema.schemaType}</span>
          </div>
        </div>
        
        {schema.references && schema.references.length > 0 && (
          <div className="mt-4">
            <span className="font-medium text-gray-500 block mb-2">References:</span>
            <div className="bg-white rounded border p-3 text-xs">
              <pre>{JSON.stringify(schema.references, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};