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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/basics/select";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";

interface EventTimeSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  onApply: () => void;
}

export const EventTimeSection: React.FC<EventTimeSectionProps> = ({
  form,
  onApply,
}) => {
  return (
    <AccordionItem value="eventTime">
      <AccordionTrigger className="flex-1 px-4">
        <div className="flex items-center gap-1">
          <CheckIcon className="size-4 text-green-500" />
          <span className="text-sm font-medium">Event time configuration</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-3 mt-2 px-6">
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

          <Button size="sm" variant="secondary" onClick={onApply} type="button">
            <ArrowPathIcon className="size-4 mr-1" />
            Apply
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
