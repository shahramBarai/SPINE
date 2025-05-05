import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
  Form,
} from "@/client/components/basics/form";
import {
  AccordionContent,
  AccordionItem,
} from "@/client/components/basics/accordion";
import { SectionHeader } from "../SectionHeader";
import {
  fieldTypes,
  KafkaSourceFormValuesTargetSchema,
  kafkaSourceSchema,
} from "./schemas";
import { useFormState } from "@/client/hooks/useFormState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/basics/select";

export const FieldsSection = ({
  data,
  onApply,
}: {
  data: KafkaSourceFormValuesTargetSchema;
  onApply: (data: KafkaSourceFormValuesTargetSchema) => Promise<boolean>;
}) => {
  // Initialize form with properly typed data
  const form = useForm<KafkaSourceFormValuesTargetSchema>({
    resolver: zodResolver(kafkaSourceSchema.shape.targetSchema),
    defaultValues: data,
  });

  const { status, handleSubmit, setStatus } = useFormState(form);

  const handleApply = async (values: KafkaSourceFormValuesTargetSchema) => {
    await handleSubmit(values, onApply);
  };

  // Handler to add a new field
  const addField = () => {
    const currentFields = form.getValues().fields || [];
    form.setValue("fields", [
      ...currentFields,
      { key: "", type: fieldTypes.STRING },
    ]);
  };

  // Handler to remove a field
  const removeField = (index: number) => {
    const currentFields = form.getValues().fields || [];
    form.setValue(
      "fields",
      currentFields.filter((_, i) => i !== index)
    );
    setStatus("changed");
  };

  return (
    <AccordionItem value="fields">
      <SectionHeader title="Field mappings" status={status} />
      <AccordionContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleApply)}
            className="flex flex-col gap-3 mt-2 px-6"
          >
            {form.watch("fields")?.map((_, index) => (
              <div
                key={index}
                className="flex justify-between items-center gap-2"
              >
                <FormField
                  control={form.control}
                  name={`fields.${index}.key`}
                  render={({ field }) => (
                    <FormItem className="w-3/5">
                      <FormControl>
                        <Input {...field} placeholder="Field key" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`fields.${index}.type`}
                  render={({ field }) => (
                    <FormItem className="w-2/5">
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl className="w-full truncate">
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(fieldTypes).map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <Button
                  variant="danger-light"
                  onClick={() => removeField(index)}
                  type="button"
                >
                  <XMarkIcon className="size-4" />
                </Button>
              </div>
            ))}

            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" onClick={addField} type="button">
                <PlusIcon className="size-4 mr-1" /> Add Field
              </Button>
              <Button
                variant="outline"
                onClick={() => {}}
                disabled
                type="button"
              >
                <DocumentArrowDownIcon className="size-4" />
                Kafka schema
              </Button>
              <ActionButton
                className="flex-1"
                DefaultIcon={ArrowPathIcon}
                status={status}
                variant="secondary"
                type="submit"
              >
                Apply
              </ActionButton>
            </div>
          </form>
        </Form>
      </AccordionContent>
    </AccordionItem>
  );
};
