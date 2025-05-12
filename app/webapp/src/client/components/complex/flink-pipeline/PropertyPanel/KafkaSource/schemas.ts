import * as z from "zod";

export enum fieldTypes {
  STRING = "string",
  INTEGER = "integer",
  FLOAT = "float",
  BOOLEAN = "boolean",
  TIMESTAMP = "timestamp",
  ARRAY = "array",
  OBJECT = "object",
}

export const kafkaSourceSchema = z.object({
  label: z.string().default("Kafka Source"),
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
    showPreview: z.boolean().optional(),
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
  targetSchema: z.object({
    fields: z
      .array(
        z.object({
          key: z.string(),
          type: z.nativeEnum(fieldTypes),
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
export type KafkaSourceFormValuesTargetSchema = z.infer<
  typeof kafkaSourceSchema.shape.targetSchema
>;
export type KafkaSourceFormValuesEventTime = z.infer<
  typeof kafkaSourceSchema.shape.eventTime
>;

export type TargetSchema = {
  fields: {
    key: string;
    type: fieldTypes;
  }[];
};
