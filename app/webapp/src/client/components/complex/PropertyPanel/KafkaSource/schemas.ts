import * as z from "zod";

export const kafkaSourceSchema = z.object({
  // Kafka consumer specific properties
  consumer: z.object({
    topic: z.string().min(1, { message: "Topic is required" }),
    bootstrapServers: z
      .string()
      .min(1, { message: "Bootstrap servers are required" }),
    groupId: z.string().min(1, { message: "Group ID is required" }),
    properties: z.string().optional(),
    startupMode: z.enum(["earliest", "latest"]),
  }),

  // Offset specific properties
  preview: z.object({
    offsetMode: z.enum(["earliest", "latest"]),
    sampleSize: z
      .number()
      .min(1, { message: "Sample size is required" })
      .max(1000, { message: "Sample size must be less than 1000" }),
    partitions: z.string().optional(),
  }),

  // Deserialization specific properties
  deserialization: z.object({
    format: z.enum(["none", "protobuf", "json"]),
  }),

  // Field specific properties
  schema: z.object({
    fields: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      )
      .optional(),
  }),

  // Event-time specific properties
  eventTime: z.object({
    eventTimeField: z.string().optional(),
    watermarkStrategy: z.string().optional(),
    delayMs: z.number().optional(),
  }),
});

export type KafkaSourceFormValues = z.infer<typeof kafkaSourceSchema>;
export type KafkaSourceFormValuesConsumer = z.infer<
  typeof kafkaSourceSchema.shape.consumer
>;
export type KafkaSourceFormValuesPreview = z.infer<
  typeof kafkaSourceSchema.shape.preview
>;
export type KafkaSourceFormValuesDeserialization = z.infer<
  typeof kafkaSourceSchema.shape.deserialization
>;
export type KafkaSourceFormValuesFields = z.infer<
  typeof kafkaSourceSchema.shape.schema
>;
export type KafkaSourceFormValuesEventTime = z.infer<
  typeof kafkaSourceSchema.shape.eventTime
>;
