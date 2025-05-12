import { Button } from "@/client/components/basics/Button";
import { cn } from "@/client/utils";
import { BookmarkIcon } from "@heroicons/react/16/solid";
import { Node, useReactFlow } from "@xyflow/react";
import KafkaSource from "./KafkaSource";
import Filter from "./Filter";
import { KafkaSourceFormValues } from "./KafkaSource/schemas";
import { memo, useCallback } from "react";
import { FilterFormValues } from "./Filter/schemas";

const PropertyPanel = memo(
  ({ className, node }: { className?: string; node: Node | null }) => {
    const reactFlow = useReactFlow();

    // Node update handler
    const handleNodeUpdate = useCallback(
      (nodeId: string, newData: KafkaSourceFormValues | FilterFormValues) => {
        reactFlow.updateNodeData(nodeId, newData);
      },
      [reactFlow]
    );

    // Early return if no node is selected
    if (!node) {
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

    const getSourceNodeId = () => {
      const sourceNode = reactFlow
        .getEdges()
        .find((edge) => edge.target === node.id);
      return reactFlow.getNodes().find((node) => node.id === sourceNode?.source)
        ?.id;
    };

    // Determine which editor to show based on node type
    const renderEditor = () => {
      switch (node.data.label) {
        case "Kafka Source":
          return (
            <KafkaSource
              key={node.id}
              data={node.data as KafkaSourceFormValues}
              setData={(data: KafkaSourceFormValues) => {
                handleNodeUpdate(node.id, data);
              }}
            />
          );
        case "Filter":
          return (
            <Filter
              key={node.id}
              nodeId={node.id}
              sourceNodeId={getSourceNodeId()}
            />
          );
        default:
          return <div>Unknown node: {node.id}</div>;
      }
    };

    return (
      <div className={cn("flex flex-col", className)}>
        <div className="bg-surface flex justify-between items-center py-2 px-4">
          <span className="text-base font-medium text-foreground">
            {`${node.data.label} (${node.id})`}
          </span>
          <Button variant="primary">
            <BookmarkIcon className="size-4 mr-1" />
            Save
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">{renderEditor()}</div>
      </div>
    );
  }
);

PropertyPanel.displayName = "PropertyPanel";

export default PropertyPanel;
