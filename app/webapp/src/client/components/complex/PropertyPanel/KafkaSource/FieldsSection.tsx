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
import { KafkaSourceFormValuesFields, kafkaSourceSchema } from "./schemas";
import { useFormState } from "@/client/hooks/useFormState";

export const FieldsSection = ({
  data,
  onApply,
}: {
  data: KafkaSourceFormValuesFields;
  onApply: (data: KafkaSourceFormValuesFields) => Promise<boolean>;
}) => {
  // Initialize form with properly typed data
  const form = useForm<KafkaSourceFormValuesFields>({
    resolver: zodResolver(kafkaSourceSchema.shape.schema),
    defaultValues: data,
  });

  const { status, handleSubmit, setStatus } = useFormState(form);

  const handleApply = async (values: KafkaSourceFormValuesFields) => {
    await handleSubmit(values, onApply);
  };

  // Handler to add a new field
  const addField = () => {
    const currentFields = form.getValues().fields || [];
    form.setValue("fields", [...currentFields, { key: "", value: "" }]);
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
                    <FormItem className="w-2/5">
                      <FormControl>
                        <Input {...field} placeholder="Field key" />
                      </FormControl>
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
