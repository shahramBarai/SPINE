import { platformDb } from "../../db/platform";
import {
  EntityNotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError,
} from "../../utils/errors";
import { SchemaType, SchemaFormat } from "generated/platform";

export interface CreateSchemaData {
  schemaName: string;
  schemaType: SchemaType;
  version: string;
  format?: SchemaFormat;
  schema: any;
}

export interface UpdateSchemaData {
  schemaName?: string;
  schemaType?: SchemaType;
  version?: string;
  format?: SchemaFormat;
  schema?: any;
}

export class SchemaService {
  // Get all schemas
  static async getAllSchemas() {
    try {
      return await platformDb.schema.findMany({
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getAllSchemas", error);
    }
  }

  // Get schema by id
  static async getSchemaById(id: string) {
    if (!id) {
      throw ValidationError("id", "Schema ID is required");
    }

    try {
      const schema = await platformDb.schema.findUnique({
        where: { id },
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });

      if (!schema) {
        throw EntityNotFoundError("Schema", id);
      }

      return schema;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getSchemaById", error);
    }
  }

  // Get schema by name and version
  static async getSchemaByNameAndVersion(name: string, version: string) {
    if (!name) {
      throw ValidationError("name", "Schema name is required");
    }
    if (version === undefined || version === null) {
      throw ValidationError("version", "Schema version is required");
    }

    try {
      const schema = await platformDb.schema.findFirst({
        where: {
          schemaName: name,
          version,
        },
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });

      if (!schema) {
        throw EntityNotFoundError("Schema", `${name}:${version}`);
      }

      return schema;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getSchemaByNameAndVersion", error);
    }
  }

  // Get schemas by name (all versions)
  static async getSchemasByName(name: string) {
    if (!name) {
      throw ValidationError("name", "Schema name is required");
    }

    try {
      return await platformDb.schema.findMany({
        where: { schemaName: name },
        orderBy: { version: "desc" },
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getSchemasByName", error);
    }
  }

  // Create schema
  static async createSchema(data: CreateSchemaData) {
    if (!data.schemaName) {
      throw ValidationError("schemaName", "Schema name is required");
    }
    if (data.version === undefined || data.version === null) {
      throw ValidationError("version", "Schema version is required");
    }
    if (!data.schema) {
      throw ValidationError("schema", "Schema object is required");
    }

    // Check if schema with same name and version already exists
    const existingSchema = await this.schemaExistsByNameAndVersion(
      data.schemaName,
      data.version
    );
    if (existingSchema) {
      throw ConflictError(
        "Schema",
        `Schema with name '${data.schemaName}' and version '${data.version}' already exists`
      );
    }

    try {
      return await platformDb.schema.create({
        data: {
          schemaName: data.schemaName,
          schemaType: data.schemaType,
          version: data.version,
          format: data.format,
          schema: data.schema,
        },
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("createSchema", error);
    }
  }

  // Update schema
  static async updateSchema(id: string, data: UpdateSchemaData) {
    if (!id) {
      throw ValidationError("id", "Schema ID is required");
    }

    // Check if schema exists
    const existingSchema = await this.getSchemaById(id); // This will throw EntityNotFoundError if not found

    // If name and version are being changed, check for conflicts
    if (data.schemaName && data.version !== undefined) {
      if (
        data.schemaName !== existingSchema.schemaName ||
        data.version !== existingSchema.version
      ) {
        const nameVersionExists = await this.schemaExistsByNameAndVersion(
          data.schemaName,
          data.version
        );
        if (nameVersionExists) {
          throw ConflictError(
            "Schema",
            `Schema with name '${data.schemaName}' and version '${data.version}' already exists`
          );
        }
      }
    }

    try {
      return await platformDb.schema.update({
        where: { id },
        data: {
          ...data,
        },
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("updateSchema", error);
    }
  }

  // Delete schema
  static async deleteSchema(id: string) {
    if (!id) {
      throw ValidationError("id", "Schema ID is required");
    }

    // Check if schema exists
    const schema = await this.getSchemaById(id); // This will throw EntityNotFoundError if not found

    // Check if schema is being used by any Kafka topics
    if (schema.topics && schema.topics.length > 0) {
      throw ConflictError(
        "Schema",
        "Cannot delete schema that is being used by Kafka topics"
      );
    }

    try {
      return await platformDb.schema.delete({
        where: { id },
      });
    } catch (error: any) {
      throw DatabaseError("deleteSchema", error);
    }
  }

  // Get latest version of schema by name
  static async getLatestSchemaVersion(name: string) {
    if (!name) {
      throw ValidationError("name", "Schema name is required");
    }

    try {
      const schema = await platformDb.schema.findFirst({
        where: { schemaName: name },
        orderBy: { version: "desc" },
        include: {
          topics: true,
          connectors: true,
          validators: true,
        },
      });

      if (!schema) {
        throw EntityNotFoundError("Schema", name);
      }

      return schema;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getLatestSchemaVersion", error);
    }
  }

  // Check if schema exists by ID
  static async schemaExists(id: string): Promise<boolean> {
    if (!id) {
      return false;
    }

    try {
      const schema = await platformDb.schema.findUnique({
        where: { id },
        select: { id: true },
      });
      return !!schema;
    } catch (error: any) {
      throw DatabaseError("schemaExists", error);
    }
  }

  // Check if schema exists by name and version
  static async schemaExistsByNameAndVersion(
    name: string,
    version: string
  ): Promise<boolean> {
    if (!name || version === undefined || version === null) {
      return false;
    }

    try {
      const schema = await platformDb.schema.findFirst({
        where: {
          schemaName: name,
          version,
        },
        select: { id: true },
      });
      return !!schema;
    } catch (error: any) {
      throw DatabaseError("schemaExistsByNameAndVersion", error);
    }
  }

  // Get unique schema names
  static async getUniqueSchemaNames() {
    try {
      const schemas = await platformDb.schema.findMany({
        distinct: ["schemaName"],
        select: {
          schemaName: true,
        },
        orderBy: { schemaName: "asc" },
      });
      return schemas.map((s) => s.schemaName);
    } catch (error: any) {
      throw DatabaseError("getUniqueSchemaNames", error);
    }
  }

  // Get schemas by type
  static async getSchemasByType(schemaType: SchemaType) {
    return platformDb.schema.findMany({
      where: { schemaType },
      include: {
        topics: true,
        connectors: true,
        validators: true,
      },
    });
  }

  // Get schemas by format
  static async getSchemasByFormat(format: SchemaFormat) {
    return platformDb.schema.findMany({
      where: { format },
      include: {
        topics: true,
        connectors: true,
        validators: true,
      },
    });
  }

  // Get schema usage (topics, connectors, validators using this schema)
  static async getSchemaUsage(id: string) {
    const schema = await platformDb.schema.findUnique({
      where: { id },
      include: {
        topics: {
          select: {
            topicName: true,
            stage: true,
            dataFormat: true,
          },
        },
        connectors: {
          select: {
            id: true,
            connectorName: true,
            connectorType: true,
          },
        },
        validators: {
          select: {
            id: true,
            sourceTopicName: true,
            targetTopicName: true,
          },
        },
      },
    });

    if (!schema) {
      return null;
    }

    return {
      schema: {
        id: schema.id,
        schemaName: schema.schemaName,
        version: schema.version,
        schemaType: schema.schemaType,
        format: schema.format,
      },
      usage: {
        topics: schema.topics,
        connectors: schema.connectors,
        validators: schema.validators,
      },
      totalUsage:
        schema.topics.length +
        schema.connectors.length +
        schema.validators.length,
    };
  }

  // Get all versions of a schema
  static async getSchemaVersions(schemaName: string) {
    return platformDb.schema.findMany({
      where: { schemaName },
      select: {
        id: true,
        version: true,
        createdAt: true,
        schemaType: true,
        format: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  // Compare two schema versions
  static async compareSchemaVersions(id1: string, id2: string) {
    const schemas = await platformDb.schema.findMany({
      where: {
        id: {
          in: [id1, id2],
        },
      },
      select: {
        id: true,
        schemaName: true,
        version: true,
        schema: true,
        createdAt: true,
      },
    });

    if (schemas.length !== 2) {
      throw new Error("One or both schemas not found");
    }

    return {
      schema1: schemas.find((s) => s.id === id1),
      schema2: schemas.find((s) => s.id === id2),
    };
  }

  // Get input schemas
  static async getInputSchemas() {
    return platformDb.schema.findMany({
      where: { schemaType: SchemaType.INPUT },
      include: {
        topics: true,
        connectors: true,
      },
    });
  }

  // Get output schemas
  static async getOutputSchemas() {
    return platformDb.schema.findMany({
      where: { schemaType: SchemaType.OUTPUT },
      include: {
        topics: true,
        validators: true,
      },
    });
  }
}
