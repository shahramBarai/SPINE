import {
  AccordionContent,
  AccordionTrigger,
} from "@/client/components/basics/accordion";
import { AccordionItem } from "@/client/components/basics/accordion";
import { useNodesData } from "@xyflow/react";
import { TargetSchema } from "@/client/components/complex/flink-piplien/PropertyPanel/KafkaSource/schemas";

export const FieldSection = ({ sourceNodeId }: { sourceNodeId?: string }) => {
  const sourceNode = useNodesData(sourceNodeId ? [sourceNodeId] : []);

  const targetSchema =
    sourceNode.length > 0
      ? (sourceNode[0]?.data?.targetSchema as TargetSchema)
      : null;

  return (
    <AccordionItem value="fields">
      <AccordionTrigger className="flex-1 px-4 text-sm font-medium">
        Fields
      </AccordionTrigger>
      <AccordionContent>
        {targetSchema ? (
          <div className="grid grid-cols-3 gap-1 px-6">
            {targetSchema.fields.map((field) => (
              <div
                key={field.key}
                className="flex items-center justify-between px-2 py-1 border border-border bg-surface"
              >
                <span className="text-xs text-surface-foreground truncate">
                  {field.key}
                </span>
                <span className="text-xs text-muted-foreground">
                  {field.type}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full text-sm text-center text-muted-foreground">
            No fields
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default FieldSection;
