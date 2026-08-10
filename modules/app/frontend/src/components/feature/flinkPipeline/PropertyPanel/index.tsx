import { memo, useCallback } from "react";
import { BookmarkIcon } from "@heroicons/react/16/solid";
import { type Node, useReactFlow } from "@xyflow/react";
import { cn } from "utils/index";
import { Button } from "components/basics/Button";
import KafkaSource from "./KafkaSource";
import Filter from "./Filter";
import { type KafkaSourceFormValues } from "./KafkaSource/schemas";
import { type FilterFormValues } from "./Filter/schemas";

/** Editor for whichever node is selected on the canvas, if any. */
const PropertyPanel = memo(
    ({ className, node }: { className?: string; node: Node | null }) => {
        const reactFlow = useReactFlow();

        const handleNodeUpdate = useCallback(
            (
                nodeId: string,
                newData: KafkaSourceFormValues | FilterFormValues
            ) => {
                reactFlow.updateNodeData(nodeId, newData);
            },
            [reactFlow]
        );

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

        /** The node feeding this one, whose output schema it can filter on. */
        const getSourceNodeId = () => {
            const incomingEdge = reactFlow
                .getEdges()
                .find((edge) => edge.target === node.id);

            return reactFlow
                .getNodes()
                .find((candidate) => candidate.id === incomingEdge?.source)?.id;
        };

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
                    <span className="text-base font-medium text-foreground">{`${node.data.label} (${node.id})`}</span>
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
