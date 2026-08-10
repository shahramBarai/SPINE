import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { ActionButton } from "components/basics/Button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel
} from "components/basics/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";
import { AccordionContent, AccordionItem } from "components/basics/accordion";
import {
    type KafkaSourceFormValuesDeserialization,
    kafkaSourceSchema
} from "./schemas";
import { SectionHeader } from "../SectionHeader";
import { useFormState } from "../../hooks/useFormState";

export const DeserializationSection = ({
    data,
    onApply
}: {
    data: KafkaSourceFormValuesDeserialization;
    onApply: (data: KafkaSourceFormValuesDeserialization) => Promise<boolean>;
}) => {
    const form = useForm<KafkaSourceFormValuesDeserialization>({
        resolver: zodResolver(kafkaSourceSchema.shape.deserialization),
        defaultValues: data
    });

    const { status, handleSubmit } = useFormState(form);

    const handleApply = async (
        values: KafkaSourceFormValuesDeserialization
    ) => {
        await handleSubmit(values, onApply);
    };

    return (
        <AccordionItem value="deserialization">
            <SectionHeader title="Deserialization settings" status={status} />
            <AccordionContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleApply)}
                        className="flex flex-col gap-3 mt-2 px-6"
                    >
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
                                            <SelectItem value="none">
                                                None
                                            </SelectItem>
                                            <SelectItem value="protobuf">
                                                Protobuf
                                            </SelectItem>
                                            <SelectItem value="json">
                                                JSON
                                            </SelectItem>
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
