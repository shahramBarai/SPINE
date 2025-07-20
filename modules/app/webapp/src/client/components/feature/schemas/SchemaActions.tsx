import { useState } from "react";
import { api } from "@/utils/trpc";
import { SchemaVersion, CompatibilityLevel } from "@/server/schemas/schema-registry";
import { Button } from "@/client/components/basics/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/basics/select";
import { 
  ShieldCheckIcon, 
  TrashIcon, 
  ExclamationTriangleIcon 
} from "@heroicons/react/24/outline";

interface SchemaActionsProps {
  subject: string;
  schema: SchemaVersion;
  onDeleteSuccess?: () => void;
}

export const SchemaActions: React.FC<SchemaActionsProps> = ({
  subject,
  onDeleteSuccess,
}) => {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedCompatibility, setSelectedCompatibility] = useState<CompatibilityLevel>("BACKWARD");

  const utils = api.useUtils();

  const updateCompatibilityMutation = api.schemaRegistry.updateCompatibility.useMutation({
    onSuccess: () => {
      void utils.schemaRegistry.invalidate();
    },
  });

  const deleteSubjectMutation = api.schemaRegistry.deleteSubject.useMutation({
    onSuccess: () => {
      void utils.schemaRegistry.invalidate();
      onDeleteSuccess?.();
    },
  });

  const handleUpdateCompatibility = async () => {
    try {
      await updateCompatibilityMutation.mutateAsync({
        subject,
        compatibility: selectedCompatibility,
      });
    } catch (error) {
      console.error('Failed to update compatibility:', error);
    }
  };

  const handleDelete = async (permanent: boolean = false) => {
    try {
      await deleteSubjectMutation.mutateAsync({
        subject,
        permanent,
      });
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error('Failed to delete subject:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">Schema Actions</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage compatibility settings and schema lifecycle
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Compatibility Management */}
        <div>
          <div className="flex items-center space-x-2 mb-3">
            <ShieldCheckIcon className="h-5 w-5 text-blue-500" />
            <h4 className="text-md font-medium text-gray-900">
              Update Compatibility Level
            </h4>
          </div>
          
          <div className="flex items-center space-x-3">
            <Select
              value={selectedCompatibility}
              onValueChange={(value) => setSelectedCompatibility(value as CompatibilityLevel)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">NONE</SelectItem>
                <SelectItem value="BACKWARD">BACKWARD</SelectItem>
                <SelectItem value="FORWARD">FORWARD</SelectItem>
                <SelectItem value="FULL">FULL</SelectItem>
                <SelectItem value="BACKWARD_TRANSITIVE">BACKWARD_TRANSITIVE</SelectItem>
                <SelectItem value="FORWARD_TRANSITIVE">FORWARD_TRANSITIVE</SelectItem>
                <SelectItem value="FULL_TRANSITIVE">FULL_TRANSITIVE</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleUpdateCompatibility}
              disabled={updateCompatibilityMutation.isPending}
              className="whitespace-nowrap"
            >
              {updateCompatibilityMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            <p>Current compatibility level affects how schema evolution is validated.</p>
          </div>
        </div>

        {/* Delete Schema */}
        <div className="border-t pt-6">
          <div className="flex items-center space-x-2 mb-3">
            <TrashIcon className="h-5 w-5 text-red-500" />
            <h4 className="text-md font-medium text-gray-900">
              Delete Schema Subject
            </h4>
          </div>
          
          {!isDeleteConfirmOpen ? (
            <div>
              <Button
                variant="outline"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Delete Subject
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                This will soft delete the subject. It can be restored later.
              </p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <h5 className="text-sm font-medium text-red-800">
                    Confirm Deletion
                  </h5>
                  <p className="text-sm text-red-700 mt-1">
                    Are you sure you want to delete the subject &quot;{subject}&quot;? 
                    This action will remove all versions of this schema.
                  </p>
                  
                  <div className="mt-4 flex space-x-3">
                    <Button
                      size="sm"
                      onClick={() => handleDelete(false)}
                      disabled={deleteSubjectMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteSubjectMutation.isPending ? "Deleting..." : "Soft Delete"}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(true)}
                      disabled={deleteSubjectMutation.isPending}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Permanent Delete
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      disabled={deleteSubjectMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {(updateCompatibilityMutation.error || deleteSubjectMutation.error) && (
        <div className="p-4 border-t bg-red-50">
          <div className="text-red-800 text-sm">
            <strong>Error:</strong>{" "}
            {updateCompatibilityMutation.error?.message || 
             deleteSubjectMutation.error?.message}
          </div>
        </div>
      )}
    </div>
  );
};