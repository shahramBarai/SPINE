import { z } from 'zod';

export const schemaTypeEnum = z.enum(['AVRO', 'JSON', 'PROTOBUF']);
export const compatibilityEnum = z.enum([
  'NONE',
  'BACKWARD',
  'FORWARD', 
  'FULL',
  'BACKWARD_TRANSITIVE',
  'FORWARD_TRANSITIVE',
  'FULL_TRANSITIVE'
]);

export const schemaFiltersSchema = z.object({
  search: z.string().optional(),
  schemaType: schemaTypeEnum.optional(),
  topic: z.string().optional(),
});

export const getSubjectVersionsSchema = z.object({
  subject: z.string().min(1),
});

export const getSchemaVersionSchema = z.object({
  subject: z.string().min(1),
  version: z.union([z.number().int().positive(), z.literal('latest')]),
});

export const registerSchemaSchema = z.object({
  subject: z.string().min(1),
  schema: z.string().min(1),
  schemaType: schemaTypeEnum.default('AVRO'),
  references: z.array(z.any()).optional(),
});

export const checkCompatibilitySchema = z.object({
  subject: z.string().min(1),
  version: z.union([z.number().int().positive(), z.literal('latest')]).default('latest'),
  schema: z.string().min(1),
});

export const updateCompatibilitySchema = z.object({
  subject: z.string().min(1),
  compatibility: compatibilityEnum,
});

export const deleteSubjectSchema = z.object({
  subject: z.string().min(1),
  permanent: z.boolean().default(false),
});

export const validateSchemaSchema = z.object({
  schema: z.string().min(1),
  schemaType: schemaTypeEnum,
});

export const compareVersionsSchema = z.object({
  subject: z.string().min(1),
  versionA: z.number().int().positive(),
  versionB: z.number().int().positive(),
});

// Response types
export const schemaSubjectSchema = z.object({
  subject: z.string(),
  latestVersion: z.number(),
  schemaType: schemaTypeEnum,
  compatibility: compatibilityEnum,
  versions: z.array(z.number()),
});

export const schemaVersionSchema = z.object({
  id: z.number(),
  version: z.number(),
  schema: z.string(),
  subject: z.string(),
  schemaType: schemaTypeEnum,
  references: z.array(z.any()).optional(),
});

export const registerSchemaResponseSchema = z.object({
  id: z.number(),
});

export const compatibilityCheckResponseSchema = z.object({
  is_compatible: z.boolean(),
  messages: z.array(z.string()).optional(),
});

export const updateCompatibilityResponseSchema = z.object({
  compatibility: z.string(),
});

export const deleteSubjectResponseSchema = z.array(z.number());

// Type exports
export type SchemaFilters = z.infer<typeof schemaFiltersSchema>;
export type SchemaSubject = z.infer<typeof schemaSubjectSchema>;
export type SchemaVersion = z.infer<typeof schemaVersionSchema>;
export type RegisterSchemaRequest = z.infer<typeof registerSchemaSchema>;
export type RegisterSchemaResponse = z.infer<typeof registerSchemaResponseSchema>;
export type CompatibilityCheckResponse = z.infer<typeof compatibilityCheckResponseSchema>;
export type SchemaType = z.infer<typeof schemaTypeEnum>;
export type CompatibilityLevel = z.infer<typeof compatibilityEnum>;