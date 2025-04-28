import * as z from "zod";

export const kafkaSourceSchema = z.object({
  // Kafka consumer specific properties
  topic: z.string().optional(),
  bootstrapServers: z.string().optional(),
  groupId: z.string().optional(),
  properties: z.string().optional(),
  startupMode: z.string().optional(),

  // Offset specific properties
  offsetMode: z.string().optional(),
  sampleSize: z.number().optional(),
  partitions: z.string().optional(),

  // Deserialization specific properties
  format: z.enum(["none", "protobuf", "json"]).optional(),

  // Field specific properties
  fields: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      })
    )
    .optional(),

  // Event-time specific properties
  eventTimeField: z.string().optional(),
  watermarkStrategy: z.string().optional(),
  delayMs: z.number().optional(),
});

export type KafkaSourceFormValues = z.infer<typeof kafkaSourceSchema>;
