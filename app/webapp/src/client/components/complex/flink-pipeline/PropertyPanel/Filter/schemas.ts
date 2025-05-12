import * as z from "zod";

export const filterSchema = z.object({
  label: z.string().default("Filter"),
  fields: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ),
});

export type FilterFormValues = z.infer<typeof filterSchema>;
export type FilterFormValuesField = z.infer<typeof filterSchema.shape.fields>;
