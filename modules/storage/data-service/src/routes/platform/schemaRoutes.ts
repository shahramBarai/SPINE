import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  SchemaService,
  CreateSchemaData,
  UpdateSchemaData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";
import { SchemaType, SchemaFormat } from "generated/platform";

interface SchemaParams {
  id: string;
}

interface SchemaNameParams {
  schemaName: string;
}

interface CompareParams {
  id1: string;
  id2: string;
}

export const schemaRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all schemas
  fastify.get(
    "/schemas",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const schemas = await SchemaService.getAllSchemas();
      reply.send(schemas);
    })
  );

  // Get schema by id
  fastify.get(
    "/schemas/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const schema = await SchemaService.getSchemaById(id);
      if (!schema) {
        reply.code(404).send({ error: "Schema not found" });
        return;
      }
      reply.send(schema);
    })
  );

  // Get schemas by name
  fastify.get(
    "/schemas/name/:schemaName",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { schemaName } = request.params as { schemaName: string };
      const schemas = await SchemaService.getSchemasByName(schemaName);
      reply.send(schemas);
    })
  );

  // Get latest schema version by name
  fastify.get(
    "/schemas/name/:schemaName/latest",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { schemaName } = request.params as { schemaName: string };
      const schema = await SchemaService.getLatestSchemaVersion(schemaName);
      if (!schema) {
        reply.code(404).send({ error: "Schema not found" });
        return;
      }
      reply.send(schema);
    })
  );

  // Get schemas by type
  fastify.get(
    "/schemas/type/:schemaType",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { schemaType } = request.params as { schemaType: SchemaType };
      const schemas = await SchemaService.getSchemasByType(schemaType);
      reply.send(schemas);
    })
  );

  // Get schemas by format
  fastify.get(
    "/schemas/format/:format",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { format } = request.params as { format: SchemaFormat };
      const schemas = await SchemaService.getSchemasByFormat(format);
      reply.send(schemas);
    })
  );

  // Get input schemas
  fastify.get(
    "/schemas/input",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const schemas = await SchemaService.getInputSchemas();
      reply.send(schemas);
    })
  );

  // Get output schemas
  fastify.get(
    "/schemas/output",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const schemas = await SchemaService.getOutputSchemas();
      reply.send(schemas);
    })
  );

  // Create schema
  fastify.post(
    "/schemas",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreateSchemaData;

      // Check if schema with same name and version already exists
      const schemaExists = await SchemaService.schemaExistsByNameAndVersion(
        data.schemaName,
        data.version
      );
      if (schemaExists) {
        reply
          .code(409)
          .send({ error: "Schema with this name and version already exists" });
        return;
      }

      const schema = await SchemaService.createSchema(data);
      reply.code(201).send(schema);
    })
  );

  // Update schema
  fastify.put(
    "/schemas/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateSchemaData;

      // Check if schema exists
      const existingSchema = await SchemaService.getSchemaById(id);
      if (!existingSchema) {
        reply.code(404).send({ error: "Schema not found" });
        return;
      }

      const schema = await SchemaService.updateSchema(id, data);
      reply.send(schema);
    })
  );

  // Delete schema
  fastify.delete(
    "/schemas/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      // Check if schema exists
      const existingSchema = await SchemaService.getSchemaById(id);
      if (!existingSchema) {
        reply.code(404).send({ error: "Schema not found" });
        return;
      }

      await SchemaService.deleteSchema(id);
      reply.code(204).send();
    })
  );

  // Get schema usage
  fastify.get(
    "/schemas/:id/usage",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const usage = await SchemaService.getSchemaUsage(id);
      if (!usage) {
        reply.code(404).send({ error: "Schema not found" });
        return;
      }
      reply.send(usage);
    })
  );

  // Get schema versions
  fastify.get(
    "/schemas/name/:schemaName/versions",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { schemaName } = request.params as { schemaName: string };
      const versions = await SchemaService.getSchemaVersions(schemaName);
      reply.send(versions);
    })
  );

  // Compare schema versions
  fastify.get(
    "/schemas/:id1/compare/:id2",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id1, id2 } = request.params as { id1: string; id2: string };
      const comparison = await SchemaService.compareSchemaVersions(id1, id2);
      reply.send(comparison);
    })
  );
};
