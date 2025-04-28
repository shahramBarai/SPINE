import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  CheckIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/16/solid";
import { PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@/client/components/basics/button";
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
  AccordionTrigger,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";

interface FieldsSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  onApply: () => void;
}

export const FieldsSection: React.FC<FieldsSectionProps> = ({
  form,
  onApply,
}) => {
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
      <AccordionTrigger className="flex-1 px-4">
        <div className="flex items-center gap-1">
          <CheckIcon className="size-4 text-green-500" />
          <span className="text-sm font-medium">Field mappings</span>
        </div>
      </AccordionTrigger>
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
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removeField(index)}
                type="button"
              >
                <XMarkIcon className="size-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addField}
              type="button"
            >
              <PlusIcon className="size-4 mr-1" /> Add Field
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {}}
              type="button"
              disabled
            >
              <DocumentArrowDownIcon className="size-4" />
              Kafka schema
            </Button>
            <div className="w-full">
              <Button
                size="sm"
                variant="secondary"
                onClick={onApply}
                type="button"
                className="w-full"
              >
                <ArrowPathIcon className="size-4 mr-1" />
                Apply
              </Button>
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
