import { Button } from "@/client/components/basics/Button";
import { cn } from "@/client/utils";
import { BookmarkIcon } from "@heroicons/react/16/solid";
import { Node } from "@xyflow/react";
import KafkaSource from "./KafkaSource";
import Filter from "./Filter";
import { KafkaSourceFormValues } from "./KafkaSource/schemas";

export * from "./KafkaSource/index";

export const PropertyPanel = ({
  className,
  selectedNode,
  onNodeUpdate,
}: {
  className?: string;
  selectedNode: Node | null;
  onNodeUpdate: (nodeId: string, data: KafkaSourceFormValues) => void;
}) => {
  // Early return if no node is selected
  if (!selectedNode) {
    return (
      <div className={cn("flex flex-col", className)}>
        <div className="bg-surface flex justify-between items-center py-2 px-4">
          <span className="text-base font-medium text-muted-foreground">
            No node selected
          </span>
        </div>
      </div>
    );
  }

  // Handle node data updates
  const handleUpdate = async (data: KafkaSourceFormValues) => {
    if (selectedNode) {
      // Update the node data
      onNodeUpdate(selectedNode.id, data);
      return true;
    }
    return false;
  };

  // Determine which editor to show based on node type
  const renderEditor = () => {
    switch (selectedNode.type) {
      case "kafkaSource":
        return (
          <KafkaSource
            key={selectedNode.id}
            data={selectedNode.data as KafkaSourceFormValues}
            setData={handleUpdate}
          />
        );
      case "filter":
        return <Filter key={selectedNode.id} />;
      default:
        return <div>Unknown node type: {selectedNode.type}</div>;
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="bg-surface flex justify-between items-center py-2 px-4">
        <span className="text-base font-medium text-foreground">
          {`${selectedNode.type} (${selectedNode.id})`}
        </span>
        <Button variant="primary">
          <BookmarkIcon className="size-4 mr-1" />
          Save
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">{renderEditor()}</div>
    </div>
  );
};
