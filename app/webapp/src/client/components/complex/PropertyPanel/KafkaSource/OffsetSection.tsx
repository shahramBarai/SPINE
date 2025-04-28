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

interface OffsetSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  onApply: () => void;
}

export const OffsetSection: React.FC<OffsetSectionProps> = ({
  form,
  onApply,
}) => {
  return (
    <AccordionItem value="offset">
      <AccordionTrigger className="flex-1 px-4">
        <div className="flex items-center gap-1">
          <CheckIcon className="size-4 text-green-500" />
          <span className="text-sm font-medium">Offset configuration</span>
        </div>
      </AccordionTrigger>
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

          <Button size="sm" variant="secondary" onClick={onApply} type="button">
            <ArrowPathIcon className="size-4 mr-1" />
            Apply
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
