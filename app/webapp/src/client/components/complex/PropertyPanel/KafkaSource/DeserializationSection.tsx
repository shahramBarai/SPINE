import React from "react";
import { UseFormReturn } from "react-hook-form";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { ActionButton } from "@/client/components/basics/Button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/client/components/basics/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/basics/select";
import {
  AccordionContent,
  AccordionItem,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";
import { useFormState } from "@/client/hooks/useFormState";
import { SectionHeader } from "../SectionHeader";

interface DeserializationSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  data: KafkaSourceFormValues;
  onApply: () => Promise<boolean>;
}

export const DeserializationSection: React.FC<DeserializationSectionProps> = ({
  form,
  data,
  onApply,
}) => {
  const watchFields: (keyof KafkaSourceFormValues)[] = ["format"];

  const { status, handleChange, hasChanges } = useFormState(
    form,
    watchFields,
    data
  );

  return (
    <AccordionItem value="deserialization">
      <SectionHeader
        title="Deserialization settings"
        status={status}
        hasChanges={hasChanges()}
      />
      <AccordionContent>
        <div className="flex flex-col gap-3 mt-2 px-6">
          <FormField
            control={form.control}
            name="format"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Format
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="protobuf">Protobuf</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
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
