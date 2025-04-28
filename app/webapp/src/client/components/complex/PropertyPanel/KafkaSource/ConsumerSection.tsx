import React from "react";
import { UseFormReturn } from "react-hook-form";
import { CheckIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import { Button } from "@/client/components/basics/button";
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
  AccordionTrigger,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";

interface ConsumerSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  onApply: () => void;
}

export const ConsumerSection: React.FC<ConsumerSectionProps> = ({
  form,
  onApply,
}) => {
  return (
    <AccordionItem value="consumer">
      <AccordionTrigger className="flex-1 px-4">
        <div className="flex items-center gap-1">
          <CheckIcon className="size-4 text-green-500" />
          <span className="text-sm font-medium">Kafka consumer spec.</span>
        </div>
      </AccordionTrigger>
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
                  <Input className="w-full" {...field} />
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
                  <Input className="w-full" {...field} />
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
                  <Input className="w-full" {...field} />
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
                  <Input className="w-full" {...field} />
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
                  <Input className="w-full" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          <Button size="sm" variant="secondary" onClick={onApply} type="button">
            <ArrowPathIcon className="size-4 mr-1" />
            Apply
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
