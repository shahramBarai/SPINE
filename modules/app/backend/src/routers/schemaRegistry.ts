import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { adminProcedure } from "../procedures/admin";
import { SchemaRegistryClient } from "../clients";

// Backs the /admin/schemas pages (components/feature/schemas). Admin-only for
// the same reason as the Kafka router: this is cluster-wide state, not
// project-scoped data.

const schemaTypeEnum = z.enum(["AVRO", "JSON", "PROTOBUF"]);
const compatibilityEnum = z.enum([
    "NONE",
    "BACKWARD",
    "FORWARD",
    "FULL",
    "BACKWARD_TRANSITIVE",
    "FORWARD_TRANSITIVE",
    "FULL_TRANSITIVE"
]);
const versionSchema = z.union([
    z.number().int().positive(),
    z.literal("latest")
]);

const subjectSchema = z.object({ subject: z.string().min(1) });

const schemaFiltersSchema = z.object({
    search: z.string().optional(),
    schemaType: schemaTypeEnum.optional(),
    topic: z.string().optional()
});

/**
 * Maps a registry failure onto a tRPC code: its own 4xx responses are the
 * caller's fault, anything else is ours (unreachable registry, 5xx, ...).
 */
function asTRPCError(error: unknown, message: string): TRPCError {
    const status =
        error instanceof SchemaRegistryClient.SchemaRegistryError
            ? error.status
            : undefined;

    return new TRPCError({
        code: status && status < 500 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
        message:
            error instanceof Error ? `${message}: ${error.message}` : message,
        cause: error
    });
}

/**
 * Format-only check, done here rather than in the client because it never
 * touches the registry - AVRO and JSON schemas have to parse as JSON, and
 * Protobuf is accepted as-is.
 */
function isWellFormed(schema: string, schemaType: string): boolean {
    if (schemaType === "PROTOBUF") {
        return true;
    }

    try {
        JSON.parse(schema);
        return true;
    } catch {
        return false;
    }
}

export const schemaRegistryRouter = router({
    listSubjects: adminProcedure
        .input(schemaFiltersSchema.optional())
        .query(async ({ input }) => {
            try {
                return await SchemaRegistryClient.listSubjects(input);
            } catch (error) {
                throw asTRPCError(error, "Failed to list schema subjects");
            }
        }),

    getSubjectVersions: adminProcedure
        .input(subjectSchema)
        .query(async ({ input }) => {
            try {
                return await SchemaRegistryClient.getSubjectVersions(
                    input.subject
                );
            } catch (error) {
                throw asTRPCError(
                    error,
                    `Failed to get versions for subject: ${input.subject}`
                );
            }
        }),

    getSchemaVersion: adminProcedure
        .input(subjectSchema.extend({ version: versionSchema }))
        .query(async ({ input }) => {
            try {
                return await SchemaRegistryClient.getSchemaVersion(
                    input.subject,
                    input.version
                );
            } catch (error) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Schema not found: ${input.subject} version ${input.version}`,
                    cause: error
                });
            }
        }),

    compareVersions: adminProcedure
        .input(
            subjectSchema.extend({
                versionA: z.number().int().positive(),
                versionB: z.number().int().positive()
            })
        )
        .query(async ({ input }) => {
            try {
                const [versionA, versionB] = await Promise.all([
                    SchemaRegistryClient.getSchemaVersion(
                        input.subject,
                        input.versionA
                    ),
                    SchemaRegistryClient.getSchemaVersion(
                        input.subject,
                        input.versionB
                    )
                ]);

                return { subject: input.subject, versionA, versionB };
            } catch (error) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Failed to compare versions for subject: ${input.subject}`,
                    cause: error
                });
            }
        }),

    checkCompatibility: adminProcedure
        .input(
            subjectSchema.extend({
                version: versionSchema.default("latest"),
                schema: z.string().min(1)
            })
        )
        .query(async ({ input }) => {
            try {
                return await SchemaRegistryClient.checkCompatibility(
                    input.subject,
                    input.version,
                    input.schema
                );
            } catch (error) {
                throw asTRPCError(
                    error,
                    "Failed to check schema compatibility"
                );
            }
        }),

    validateSchema: adminProcedure
        .input(
            z.object({
                schema: z.string().min(1),
                schemaType: schemaTypeEnum
            })
        )
        .query(({ input }) => {
            return { isValid: isWellFormed(input.schema, input.schemaType) };
        }),

    registerSchema: adminProcedure
        .input(
            subjectSchema.extend({
                schema: z.string().min(1),
                schemaType: schemaTypeEnum.default("AVRO"),
                references: z.array(z.unknown()).optional()
            })
        )
        .mutation(async ({ input }) => {
            if (!isWellFormed(input.schema, input.schemaType)) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Invalid ${input.schemaType} schema: not valid JSON`
                });
            }

            try {
                const result = await SchemaRegistryClient.registerSchema(
                    input.subject,
                    {
                        schema: input.schema,
                        schemaType: input.schemaType,
                        references: input.references
                    }
                );

                return {
                    ...result,
                    subject: input.subject,
                    schemaType: input.schemaType
                };
            } catch (error) {
                throw asTRPCError(
                    error,
                    `Failed to register schema for subject: ${input.subject}`
                );
            }
        }),

    updateCompatibility: adminProcedure
        .input(subjectSchema.extend({ compatibility: compatibilityEnum }))
        .mutation(async ({ input }) => {
            try {
                return await SchemaRegistryClient.updateCompatibility(
                    input.subject,
                    input.compatibility
                );
            } catch (error) {
                throw asTRPCError(
                    error,
                    `Failed to update compatibility for subject: ${input.subject}`
                );
            }
        }),

    deleteSubject: adminProcedure
        .input(subjectSchema.extend({ permanent: z.boolean().default(false) }))
        .mutation(async ({ input }) => {
            try {
                const deletedVersions =
                    await SchemaRegistryClient.deleteSubject(
                        input.subject,
                        input.permanent
                    );

                return {
                    success: true,
                    subject: input.subject,
                    deletedVersions,
                    permanent: input.permanent
                };
            } catch (error) {
                throw asTRPCError(
                    error,
                    `Failed to delete subject: ${input.subject}`
                );
            }
        }),

    /**
     * Reports reachability as data rather than throwing, so the page's status
     * banner can render "disconnected" instead of an error boundary.
     */
    healthCheck: adminProcedure.query(async () => {
        try {
            await SchemaRegistryClient.listSubjects();

            return {
                status: "connected" as const,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: "disconnected" as const,
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: new Date().toISOString()
            };
        }
    })
});
