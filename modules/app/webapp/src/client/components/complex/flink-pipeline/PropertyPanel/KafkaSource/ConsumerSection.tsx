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
  FormMessage,
} from "@/client/components/basics/form";
import {
  AccordionContent,
  AccordionItem,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValuesConsumer, kafkaSourceSchema } from "./schemas";
import { SectionHeader } from "../SectionHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/basics/select";
import { useFormState } from "@/client/hooks/useFormState";

export const ConsumerSection = ({
  data,
  onApply,
}: {
  data: KafkaSourceFormValuesConsumer;
  onApply: (data: KafkaSourceFormValuesConsumer) => Promise<boolean>;
}) => {
  const form = useForm<KafkaSourceFormValuesConsumer>({
    resolver: zodResolver(kafkaSourceSchema.shape.consumer),
    defaultValues: data,
  });

  const { status, handleSubmit } = useFormState(form);

  const handleApply = async (values: KafkaSourceFormValuesConsumer) => {
    await handleSubmit(values, onApply);
  };

  return (
    <AccordionItem value="consumer">
      <SectionHeader title="Kafka consumer spec." status={status} />
      <AccordionContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleApply)}
            className="flex flex-col gap-3 mt-2 px-6"
          >
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
                  <FormMessage />
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
