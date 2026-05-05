import { z } from "zod";
import { logger } from "@spine/shared";

type AvroField = {
    name: string;
    type: unknown;
};

type AvroRecordSchema = {
    fields?: AvroField[];
};

type AvroStructuredSchema = {
    type?: string;
    items?: unknown;
    values?: unknown;
    symbols?: string[];
    size?: number;
} & Partial<AvroRecordSchema>;

/**
 * Check if a field is optional (union with null)
 * @param type - The type to check
 * @returns True if the field is optional, false otherwise
 */
function isOptionalField(type: unknown): boolean {
    if (Array.isArray(type)) {
        return type.some(
            (t) => t === "null" || (typeof t === "object" && t.type === "null")
        );
    }
    return false;
}

/**
 * Convert an Avro record to a Zod object schema
 * @param recordType - The Avro record to convert
 * @returns The Zod object schema
 */
function convertRecord(recordType: AvroRecordSchema): z.ZodTypeAny {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of recordType.fields || []) {
        let fieldSchema = convertType(field.type);

        // Handle optional fields (Avro uses union with null for optional fields)
        if (isOptionalField(field.type)) {
            fieldSchema = fieldSchema.optional();
        }

        shape[field.name] = fieldSchema;
    }

    return z.object(shape);
}

/**
 * Convert an Avro type to a Zod schema
 * @param avroType - The Avro type to convert
 * @returns The Zod schema
 * @throws Error if the Avro type is unsupported
 */
function convertType(avroType: unknown): z.ZodTypeAny {
    // Handle union types (Avro allows multiple types)
    if (Array.isArray(avroType)) {
        const zodTypes = avroType.map((type) => convertType(type));
        return z.union(
            zodTypes as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
        );
    }

    // Handle primitive types
    const structuredType = avroType as AvroStructuredSchema;

    switch (structuredType.type || avroType) {
        case "null":
            return z.null();
        case "boolean":
            return z.boolean();
        case "int":
        case "long":
        case "float":
        case "double":
            return z.number();
        case "bytes":
            return z.instanceof(Buffer);
        case "string":
            return z.string();
        case "array":
            return z.array(convertType(structuredType.items));
        case "map":
            return z.record(z.string(), convertType(structuredType.values));
        case "record":
            return convertRecord(structuredType);
        case "enum":
            return z.enum(structuredType.symbols ?? []);
        case "fixed":
            return z.string().length(structuredType.size ?? 0);
        default:
            // Handle named types (references to other schemas)
            if (typeof avroType === "string") {
                return z.any(); // For now, we'll use any for references
            }
            throw new Error(
                `Unsupported Avro type: ${avroType.type || avroType}`
            );
    }
}

/**
 * Convert an Avro schema to a Zod schema
 * @param avroSchema - The Avro schema to convert
 * @returns The Zod schema
 * @throws Error if the Avro schema is invalid
 */
function convertAvroToZod(avroSchema: unknown): z.ZodTypeAny {
    try {
        const parsedSchema =
            typeof avroSchema === "string"
                ? JSON.parse(avroSchema)
                : avroSchema;

        return convertType(parsedSchema);
    } catch (error: unknown) {
        logger.error("Failed to convert Avro schema to Zod:", error);
        throw new Error(
            `Invalid Avro schema: ${error instanceof Error ? error.message : "Unknown error"}`,
            { cause: error }
        );
    }
}

export { convertAvroToZod };
