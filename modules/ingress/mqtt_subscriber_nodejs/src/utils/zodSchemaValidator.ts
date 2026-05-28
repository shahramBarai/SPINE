import { z } from "zod";
import { logger } from "../utils/logger";

/**
 * Check if a field is optional (union with null)
 * @param type - The type to check
 * @returns True if the field is optional, false otherwise
 */
function isOptionalField(type: unknown): boolean {
    if (Array.isArray(type)) {
        return type.some(
            (t) =>
                t === "null" ||
                (typeof t === "object" &&
                    t !== null &&
                    "type" in t &&
                    t.type === "null")
        );
    }
    return false;
}

/**
 * Convert an Avro record to a Zod object schema
 * @param recordType - The Avro record to convert
 * @returns The Zod object schema
 */
function convertRecord(
    recordType: Record<string, unknown>
): z.ZodObject<Record<string, z.ZodSchema>> {
    const shape: Record<string, z.ZodSchema> = {};

    const fields = Array.isArray(recordType.fields) ? recordType.fields : [];

    for (const field of fields) {
        if (
            typeof field === "object" &&
            field !== null &&
            "type" in field &&
            "name" in field
        ) {
            let fieldSchema = convertType(field.type);

            // Handle optional fields (Avro uses union with null for optional fields)
            if (isOptionalField(field.type)) {
                fieldSchema = fieldSchema.optional();
            }

            shape[field.name as string] = fieldSchema;
        }
    }

    return z.object(shape);
}

/**
 * Convert an Avro type to a Zod schema
 * @param avroType - The Avro type to convert
 * @returns The Zod schema
 * @throws Error if the Avro type is unsupported
 */
function convertType(avroType: unknown): z.ZodSchema {
    // Handle union types (Avro allows multiple types)
    if (Array.isArray(avroType)) {
        const zodTypes = avroType.map((type) => convertType(type));
        return z.union(
            zodTypes as [z.ZodSchema, z.ZodSchema, ...z.ZodSchema[]]
        );
    }

    // Handle primitive types
    const typeKey =
        typeof avroType === "object" && avroType !== null && "type" in avroType
            ? avroType.type
            : avroType;

    switch (typeKey) {
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
            if (
                typeof avroType === "object" &&
                avroType !== null &&
                "items" in avroType
            ) {
                return z.array(convertType(avroType.items));
            }
            throw new Error("Array type missing 'items' property");
        case "map":
            if (
                typeof avroType === "object" &&
                avroType !== null &&
                "values" in avroType
            ) {
                return z.record(z.string(), convertType(avroType.values));
            }
            throw new Error("Map type missing 'values' property");
        case "record":
            if (typeof avroType === "object" && avroType !== null) {
                return convertRecord(avroType as Record<string, unknown>);
            }
            throw new Error("Record type must be an object");
        case "enum":
            if (
                typeof avroType === "object" &&
                avroType !== null &&
                "symbols" in avroType &&
                Array.isArray(avroType.symbols)
            ) {
                return z.enum(avroType.symbols as [string, ...string[]]);
            }
            throw new Error("Enum type missing or invalid 'symbols' property");
        case "fixed":
            if (
                typeof avroType === "object" &&
                avroType !== null &&
                "size" in avroType &&
                typeof avroType.size === "number"
            ) {
                return z.string().length(avroType.size);
            }
            throw new Error("Fixed type missing or invalid 'size' property");
        default:
            // Handle named types (references to other schemas)
            if (typeof typeKey === "string") {
                return z.any(); // For now, we'll use any for references
            }
            throw new Error(`Unsupported Avro type: ${typeKey}`);
    }
}

/**
 * Convert an Avro schema to a Zod schema
 * @param avroSchema - The Avro schema to convert
 * @returns The Zod schema
 * @throws Error if the Avro schema is invalid
 */
function convertAvroToZod(avroSchema: unknown): z.ZodSchema {
    try {
        const parsedSchema =
            typeof avroSchema === "string"
                ? JSON.parse(avroSchema)
                : avroSchema;

        return convertType(parsedSchema);
    } catch (error) {
        logger.error("Failed to convert Avro schema to Zod:", error);
        throw new Error(
            `Invalid Avro schema: ${error instanceof Error ? error.message : "Unknown error"}`,
            { cause: error }
        );
    }
}

export { convertAvroToZod };
