import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { getSchemaRegistryService } from "../services/schema-registry";
import {
  schemaFiltersSchema,
  getSubjectVersionsSchema,
  getSchemaVersionSchema,
  registerSchemaSchema,
  checkCompatibilitySchema,
  updateCompatibilitySchema,
  deleteSubjectSchema,
  validateSchemaSchema,
  compareVersionsSchema,
} from "../schemas/schema-registry";

export const schemaRegistryRouter = router({
  // List all subjects with optional filtering
  listSubjects: protectedProcedure
    .input(schemaFiltersSchema.optional())
    .query(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        return await schemaRegistry.listSubjects(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list schema subjects",
          cause: error,
        });
      }
    }),

  // Get all versions for a subject
  getSubjectVersions: protectedProcedure
    .input(getSubjectVersionsSchema)
    .query(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        return await schemaRegistry.getSubjectVersions(input.subject);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get versions for subject: ${input.subject}`,
          cause: error,
        });
      }
    }),

  // Get specific version of a schema
  getSchemaVersion: protectedProcedure
    .input(getSchemaVersionSchema)
    .query(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        return await schemaRegistry.getSchemaVersion(input.subject, input.version);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Schema not found: ${input.subject} version ${input.version}`,
          cause: error,
        });
      }
    }),

  // Register a new schema
  registerSchema: protectedProcedure
    .input(registerSchemaSchema)
    .mutation(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        
        // Validate schema format first
        await schemaRegistry.validateSchema(input.schema, input.schemaType);
        
        // Register the schema
        const result = await schemaRegistry.registerSchema(input.subject, {
          schema: input.schema,
          schemaType: input.schemaType,
          references: input.references,
        });

        return {
          ...result,
          subject: input.subject,
          schemaType: input.schemaType,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to register schema for subject: ${input.subject}`,
          cause: error,
        });
      }
    }),

  // Check schema compatibility
  checkCompatibility: protectedProcedure
    .input(checkCompatibilitySchema)
    .query(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        return await schemaRegistry.checkCompatibility(
          input.subject,
          input.version,
          input.schema
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to check schema compatibility",
          cause: error,
        });
      }
    }),

  // Update compatibility level for a subject
  updateCompatibility: protectedProcedure
    .input(updateCompatibilitySchema)
    .mutation(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        return await schemaRegistry.updateCompatibility(
          input.subject,
          input.compatibility
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to update compatibility for subject: ${input.subject}`,
          cause: error,
        });
      }
    }),

  // Delete a subject
  deleteSubject: protectedProcedure
    .input(deleteSubjectSchema)
    .mutation(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        const deletedVersions = await schemaRegistry.deleteSubject(
          input.subject,
          input.permanent
        );
        
        return {
          success: true,
          subject: input.subject,
          deletedVersions,
          permanent: input.permanent,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Failed to delete subject: ${input.subject}`,
          cause: error,
        });
      }
    }),

  // Validate schema format
  validateSchema: protectedProcedure
    .input(validateSchemaSchema)
    .query(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        const isValid = await schemaRegistry.validateSchema(
          input.schema,
          input.schemaType
        );
        
        return { isValid };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Schema validation failed",
          cause: error,
        });
      }
    }),

  // Compare two schema versions
  compareVersions: protectedProcedure
    .input(compareVersionsSchema)
    .query(async ({ input }) => {
      try {
        const schemaRegistry = getSchemaRegistryService();
        
        const [versionA, versionB] = await Promise.all([
          schemaRegistry.getSchemaVersion(input.subject, input.versionA),
          schemaRegistry.getSchemaVersion(input.subject, input.versionB),
        ]);

        return {
          subject: input.subject,
          versionA: {
            version: versionA.version,
            schema: versionA.schema,
            schemaType: versionA.schemaType,
          },
          versionB: {
            version: versionB.version,
            schema: versionB.schema,
            schemaType: versionB.schemaType,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Failed to compare versions for subject: ${input.subject}`,
          cause: error,
        });
      }
    }),

  // Health check for Schema Registry connection
  healthCheck: protectedProcedure.query(async () => {
    try {
      const schemaRegistry = getSchemaRegistryService();
      // Try to list subjects as a health check
      await schemaRegistry.listSubjects();
      
      return {
        status: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }),
});