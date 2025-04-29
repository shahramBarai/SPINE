import React from "react";
import { UseFormReturn } from "react-hook-form";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { ActionButton } from "@/client/components/basics/Button";
import { Input } from "@/client/components/basics/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/client/components/basics/form";
import {
  AccordionContent,
  AccordionItem,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";
import { useFormState } from "@/client/hooks/useFormState";
import { SectionHeader } from "../SectionHeader";

interface ConsumerSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  data: KafkaSourceFormValues;
  onApply: () => Promise<boolean>;
}

export const ConsumerSection: React.FC<ConsumerSectionProps> = ({
  form,
  data,
  onApply,
}) => {
  // Fields to watch for this section
  const watchFields: (keyof KafkaSourceFormValues)[] = [
    "topic",
    "bootstrapServers",
    "groupId",
    "properties",
    "startupMode",
  ];

  // Use the apply status hook
  const { status, handleChange, hasChanges } = useFormState(
    form,
    watchFields,
    data
  );

  return (
    <AccordionItem value="consumer">
      <SectionHeader
        title="Kafka consumer spec."
        status={status}
        hasChanges={hasChanges()}
      />
      <AccordionContent>
        <div className="flex flex-col gap-3 mt-2 px-6">
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Topic
                </FormLabel>
                <FormControl>
                  <Input
                    className="w-full"
                    placeholder="e.g. my-topic"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bootstrapServers"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Bootstrap servers
                </FormLabel>
                <FormControl>
                  <Input
                    className="w-full"
                    placeholder="e.g. kafka:9092"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="groupId"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Group ID
                </FormLabel>
                <FormControl>
                  <Input
                    className="w-full"
                    placeholder="e.g. my-group"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="properties"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Properties
                </FormLabel>
                <FormControl>
                  <Input
                    className="w-full"
                    placeholder="e.g. key1=value1,key2=value2,..."
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="startupMode"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Startup mode
                </FormLabel>
                <FormControl>
                  <Input
                    className="w-full"
                    placeholder="e.g. earliest, latest, specific"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <ActionButton
            DefaultIcon={ArrowPathIcon}
            status={status}
            onClick={() => handleChange(onApply)}
            disabled={!hasChanges()}
            variant="secondary"
          >
            Apply
          </ActionButton>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
