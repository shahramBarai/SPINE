import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { ActionButton } from "@/client/components/basics/Button";
import { Input } from "@/client/components/basics/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Form,
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
import { KafkaSourceFormValuesEventTime, kafkaSourceSchema } from "./schemas";
import { SectionHeader } from "../SectionHeader";
import { useFormState } from "@/client/hooks/useFormState";

export const EventTimeSection = ({
  data,
  onApply,
}: {
  data: KafkaSourceFormValuesEventTime;
  onApply: (data: KafkaSourceFormValuesEventTime) => Promise<boolean>;
}) => {
  const form = useForm<KafkaSourceFormValuesEventTime>({
    resolver: zodResolver(kafkaSourceSchema.shape.eventTime),
    defaultValues: data,
  });

  const { status, handleSubmit } = useFormState(form);

  const handleApply = async (values: KafkaSourceFormValuesEventTime) => {
    await handleSubmit(values, onApply);
  };

  return (
    <AccordionItem value="eventTime">
      <SectionHeader title="Event time configuration" status={status} />
      <AccordionContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleApply)}
            className="flex flex-col gap-3 mt-2 px-6"
          >
            <FormField
              control={form.control}
              name="eventTimeField"
              render={({ field }) => (
                <FormItem className="flex justify-between items-center gap-2">
                  <FormLabel className="w-1/3 text-sm text-muted-foreground">
                    Event Time Field
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="watermarkStrategy"
              render={({ field }) => (
                <FormItem className="flex justify-between items-center gap-2">
                  <FormLabel className="w-1/3 text-sm text-muted-foreground">
                    Watermark Strategy
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bounded">
                        Bounded out of orderness
                      </SelectItem>
                      <SelectItem value="periodic">Periodic</SelectItem>
                      <SelectItem value="punctuated">Punctuated</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="delayMs"
              render={({ field }) => (
                <FormItem className="flex justify-between items-center gap-2">
                  <FormLabel className="w-1/3 text-sm text-muted-foreground">
                    Delay (ms)
                  </FormLabel>
                  <FormControl>
                    <Input className="w-full" type="number" {...field} />
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
