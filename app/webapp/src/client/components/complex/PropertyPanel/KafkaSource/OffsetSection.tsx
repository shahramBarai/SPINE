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

interface OffsetSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  data: KafkaSourceFormValues;
  onApply: () => Promise<boolean>;
}

export const OffsetSection: React.FC<OffsetSectionProps> = ({
  form,
  data,
  onApply,
}) => {
  // Fields to watch for this section
  const watchFields: (keyof KafkaSourceFormValues)[] = ["offsetMode"];

  const { status, handleChange, hasChanges } = useFormState(
    form,
    watchFields,
    data
  );

  return (
    <AccordionItem value="offset">
      <SectionHeader
        title="Offset configuration"
        status={status}
        hasChanges={hasChanges()}
      />
      <AccordionContent>
        <div className="flex flex-col gap-3 mt-2 px-6">
          <FormField
            control={form.control}
            name="offsetMode"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Offset Mode
                </FormLabel>
                <FormControl>
                  <Input className="w-full" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sampleSize"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Sample Size
                </FormLabel>
                <FormControl>
                  <Input className="w-full" type="number" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="partitions"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Partitions
                </FormLabel>
                <FormControl>
                  <Input className="w-full" {...field} />
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
