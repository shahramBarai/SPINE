import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/client/components/basics/form";
import { KafkaSourceFormValues, kafkaSourceSchema } from "./schemas";
import { ConsumerSection } from "./ConsumerSection";
import { OffsetSection } from "./OffsetSection";
import { DeserializationSection } from "./DeserializationSection";
import { FieldsSection } from "./FieldsSection";
import { EventTimeSection } from "./EventTimeSection";
import { Accordion } from "@/client/components/basics/accordion";

interface KafkaSourceProps {
  data?: KafkaSourceFormValues;
  onUpdate?: (data: KafkaSourceFormValues) => Promise<boolean>;
}

export const KafkaSource: React.FC<KafkaSourceProps> = ({
  data = {} as KafkaSourceFormValues,
  onUpdate,
}) => {
  // Initialize the form with react-hook-form and zod validation
  const form = useForm<KafkaSourceFormValues>({
    resolver: zodResolver(kafkaSourceSchema),
    defaultValues: {
      topic: data.topic || "",
      bootstrapServers: data.bootstrapServers || "",
      groupId: data.groupId || "",
      properties: data.properties || "",
      startupMode: data.startupMode || "",
      offsetMode: data.offsetMode || "",
      sampleSize: data.sampleSize || undefined,
      partitions: data.partitions || "",
      format: data.format || undefined,
      fields: data.fields || [],
      eventTimeField: data.eventTimeField || "",
      watermarkStrategy: data.watermarkStrategy || "",
      delayMs: data.delayMs || undefined,
    },
  });

  // Handler for applying changes
  const handleApply = async (section: string) => {
    console.log("Handle Apply for section: ", section);
    const values = form.getValues();
    if (onUpdate) {
      return await onUpdate(values);
    }

    // Wait for 1 second to simulate a network request
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return true;
  };

  return (
    <Form {...form}>
      <form>
        <Accordion
          type="multiple"
          className="w-full"
          defaultValue={["consumer"]}
        >
          <ConsumerSection
            form={form}
            data={data}
            onApply={() => handleApply("consumer")}
          />
          <OffsetSection
            form={form}
            data={data}
            onApply={() => handleApply("offset")}
          />
          <DeserializationSection
            form={form}
            data={data}
            onApply={() => handleApply("deserialization")}
          />
          <FieldsSection
            form={form}
            data={data}
            onApply={() => handleApply("fields")}
          />
          <EventTimeSection
            form={form}
            data={data}
            onApply={() => handleApply("eventTime")}
          />
        </Accordion>
      </form>
    </Form>
  );
};

export default KafkaSource;
