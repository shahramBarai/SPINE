import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  ArrowPathIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/16/solid";
import { PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { ActionButton, Button } from "@/client/components/basics/Button";
import { Input } from "@/client/components/basics/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/client/components/basics/form";
import {
  AccordionContent,
  AccordionItem,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";
import { useFormState } from "@/client/hooks/useFormState";
import { SectionHeader } from "../SectionHeader";

interface FieldsSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  data: KafkaSourceFormValues;
  onApply: () => Promise<boolean>;
}

export const FieldsSection: React.FC<FieldsSectionProps> = ({
  form,
  data,
  onApply,
}) => {
  // Fields to watch for this section
  const watchFields: (keyof KafkaSourceFormValues)[] = ["fields"];

  const { status, handleChange, hasChanges } = useFormState(
    form,
    watchFields,
    data
  );

  // Handler to add a new field
  const addField = () => {
    const currentFields = form.getValues("fields") || [];
    form.setValue("fields", [...currentFields, { key: "", value: "" }]);
  };

  // Handler to remove a field
  const removeField = (index: number) => {
    const currentFields = form.getValues("fields") || [];
    form.setValue(
      "fields",
      currentFields.filter((_, i) => i !== index)
    );
  };

  return (
    <AccordionItem value="fields">
      <SectionHeader
        title="Field mappings"
        status={status}
        hasChanges={hasChanges()}
      />
      <AccordionContent>
        <div className="flex flex-col space-y-3 px-6">
          {form.watch("fields")?.map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <FormField
                control={form.control}
                name={`fields.${index}.key`}
                render={({ field }) => (
                  <FormItem className="w-2/5">
                    <FormControl>
                      <Input {...field} placeholder="Field key" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <span className="text-muted-foreground">→</span>
              <FormField
                control={form.control}
                name={`fields.${index}.value`}
                render={({ field }) => (
                  <FormItem className="w-2/5">
                    <FormControl>
                      <Input {...field} placeholder="Field value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button color="danger-light" onClick={() => removeField(index)}>
                <XMarkIcon className="size-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" onClick={addField}>
              <PlusIcon className="size-4 mr-1" /> Add Field
            </Button>
            <Button variant="outline" onClick={() => {}} disabled>
              <DocumentArrowDownIcon className="size-4" />
              Kafka schema
            </Button>
            <ActionButton
              className="flex-1"
              DefaultIcon={ArrowPathIcon}
              status={status}
              onClick={() => handleChange(onApply)}
              disabled={!hasChanges()}
              variant="secondary"
            >
              Apply
            </ActionButton>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
