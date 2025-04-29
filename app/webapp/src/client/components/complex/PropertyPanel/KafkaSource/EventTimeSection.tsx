import React from "react";
import { UseFormReturn } from "react-hook-form";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { ActionButton } from "@/client/components/basics/Button";
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
} from "@/client/components/basics/accordion";
import { KafkaSourceFormValues } from "./schemas";
import { useFormState } from "@/client/hooks/useFormState";
import { SectionHeader } from "../SectionHeader";

interface EventTimeSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  data: KafkaSourceFormValues;
  onApply: () => Promise<boolean>;
}

export const EventTimeSection: React.FC<EventTimeSectionProps> = ({
  form,
  data,
  onApply,
}) => {
  const watchFields: (keyof KafkaSourceFormValues)[] = [
    "eventTimeField",
    "watermarkStrategy",
    "delayMs",
  ];

  const { status, handleChange, hasChanges } = useFormState(
    form,
    watchFields,
    data
  );

  return (
    <AccordionItem value="eventTime">
      <SectionHeader
        title="Event time configuration"
        status={status}
        hasChanges={hasChanges()}
      />
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

          <ActionButton
            DefaultIcon={ArrowPathIcon}
            status={status}
            onClick={() => handleChange(onApply)}
            disabled={!hasChanges()}
            variant="secondary"
          >
            Apply
          </ActionButton>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};
