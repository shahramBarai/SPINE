import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { ActionButton } from "@/client/components/basics/Button";
import { Input } from "@/client/components/basics/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/client/components/basics/form";
import {
  AccordionContent,
  AccordionItem,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValuesPreview, kafkaSourceSchema } from "./schemas";
import { SectionHeader } from "../SectionHeader";
import { useFormState } from "@/client/hooks/useFormState";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/client/components/basics/select";

export const PreviewSection = ({
  data,
  onApply,
}: {
  data: KafkaSourceFormValuesPreview;
  onApply: (data: KafkaSourceFormValuesPreview) => Promise<boolean>;
}) => {
  const form = useForm<KafkaSourceFormValuesPreview>({
    resolver: zodResolver(kafkaSourceSchema.shape.preview),
    defaultValues: data,
  });

  const { status, handleSubmit } = useFormState(form);

  const handleApply = async (values: KafkaSourceFormValuesPreview) => {
    await handleSubmit(values, onApply);
  };

  return (
    <AccordionItem value="preview">
      <SectionHeader title="Preview configuration" status={status} />
      <AccordionContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleApply)}
            className="flex flex-col gap-3 mt-2 px-6"
          >
            <FormField
              control={form.control}
              name="offsetMode"
              render={({ field }) => (
                <FormItem className="flex justify-between items-center gap-2">
                  <FormLabel className="w-1/3 text-sm text-muted-foreground">
                    Offset Mode
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl className="w-full">
                      <SelectTrigger>
                        <SelectValue placeholder="Select startup mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="earliest">Earliest</SelectItem>
                      <SelectItem value="latest">Latest</SelectItem>
                    </SelectContent>
                  </Select>
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
              variant="secondary"
              type="submit"
            >
              Apply
            </ActionButton>
          </form>
        </Form>
      </AccordionContent>
    </AccordionItem>
  );
};
