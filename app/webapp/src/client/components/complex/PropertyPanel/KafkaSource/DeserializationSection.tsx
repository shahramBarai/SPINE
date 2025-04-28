import React from "react";
import { UseFormReturn } from "react-hook-form";
import { CheckIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import { Button } from "@/client/components/basics/button";
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

interface DeserializationSectionProps {
  form: UseFormReturn<KafkaSourceFormValues>;
  onApply: () => void;
}

export const DeserializationSection: React.FC<DeserializationSectionProps> = ({
  form,
  onApply,
}) => {
  return (
    <AccordionItem value="deserialization">
      <AccordionTrigger className="flex-1 px-4">
        <div className="flex items-center gap-1">
          <CheckIcon className="size-4 text-green-500" />
          <span className="text-sm font-medium">Deserialization settings</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-3 mt-2 px-6">
          <FormField
            control={form.control}
            name="format"
            render={({ field }) => (
              <FormItem className="flex justify-between items-center gap-2">
                <FormLabel className="w-1/3 text-sm text-muted-foreground">
                  Format
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="protobuf">Protobuf</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
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
