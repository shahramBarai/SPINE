import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  ConnectorService,
  CreateConnectorConfigData,
  UpdateConnectorConfigData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";
import { ConnectorType } from "generated/platform";

export const connectorRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all connectors
  fastify.get(
    "/connectors",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const connectors = await ConnectorService.getAllConnectors();
      reply.send(connectors);
    })
  );

  // Get connector by id
  fastify.get(
    "/connectors/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const connector = await ConnectorService.getConnectorById(id);
      if (!connector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }
      reply.send(connector);
    })
  );

  // Get connector by name
  fastify.get(
    "/connectors/name/:connectorName",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { connectorName } = request.params as { connectorName: string };
      const connector = await ConnectorService.getConnectorByName(
        connectorName
      );
      if (!connector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }
      reply.send(connector);
    })
  );

  // Get connectors by type
  fastify.get(
    "/connectors/type/:connectorType",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { connectorType } = request.params as {
        connectorType: ConnectorType;
      };
      const connectors = await ConnectorService.getConnectorsByType(
        connectorType
      );
      reply.send(connectors);
    })
  );

  // Get connectors by Kafka topic
  fastify.get(
    "/connectors/topic/:kafkaTopicName",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { kafkaTopicName } = request.params as { kafkaTopicName: string };
      const connectors = await ConnectorService.getConnectorsByKafkaTopic(
        kafkaTopicName
      );
      reply.send(connectors);
    })
  );

  // Get connectors by schema
  fastify.get(
    "/connectors/schema/:inputSchemaId",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { inputSchemaId } = request.params as { inputSchemaId: string };
      const connectors = await ConnectorService.getConnectorsBySchema(
        inputSchemaId
      );
      reply.send(connectors);
    })
  );

  // Get MQTT connectors
  fastify.get(
    "/connectors/mqtt",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const connectors = await ConnectorService.getMqttConnectors();
      reply.send(connectors);
    })
  );

  // Get REST connectors
  fastify.get(
    "/connectors/rest",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const connectors = await ConnectorService.getRestConnectors();
      reply.send(connectors);
    })
  );

  // Get input connectors
  fastify.get(
    "/connectors/input",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const connectors = await ConnectorService.getInputConnectors();
      reply.send(connectors);
    })
  );

  // Get connectors with schemas
  fastify.get(
    "/connectors/with-schemas",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const connectors = await ConnectorService.getConnectorsWithSchemas();
      reply.send(connectors);
    })
  );

  // Get connectors without schemas
  fastify.get(
    "/connectors/without-schemas",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const connectors = await ConnectorService.getConnectorsWithoutSchemas();
      reply.send(connectors);
    })
  );

  // Create connector
  fastify.post(
    "/connectors",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreateConnectorConfigData;

      // Check if connector with this name already exists
      const connectorExists = await ConnectorService.connectorExists(
        data.connectorName
      );
      if (connectorExists) {
        reply
          .code(409)
          .send({ error: "Connector with this name already exists" });
        return;
      }

      const connector = await ConnectorService.createConnector(data);
      reply.code(201).send(connector);
    })
  );

  // Update connector
  fastify.put(
    "/connectors/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateConnectorConfigData;

      // Check if connector exists
      const existingConnector = await ConnectorService.getConnectorById(id);
      if (!existingConnector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }

      const connector = await ConnectorService.updateConnector(id, data);
      reply.send(connector);
    })
  );

  // Delete connector
  fastify.delete(
    "/connectors/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      // Check if connector exists
      const existingConnector = await ConnectorService.getConnectorById(id);
      if (!existingConnector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }

      await ConnectorService.deleteConnector(id);
      reply.code(204).send();
    })
  );

  // Update connector configuration
  fastify.put(
    "/connectors/:id/config",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { config } = request.body as { config: any };

      // Check if connector exists
      const existingConnector = await ConnectorService.getConnectorById(id);
      if (!existingConnector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }

      const connector = await ConnectorService.updateConnectorConfig(
        id,
        config
      );
      reply.send(connector);
    })
  );

  // Update connector endpoint
  fastify.put(
    "/connectors/:id/endpoint",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { endpointUrl } = request.body as { endpointUrl: string };

      // Check if connector exists
      const existingConnector = await ConnectorService.getConnectorById(id);
      if (!existingConnector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }

      const connector = await ConnectorService.updateConnectorEndpoint(
        id,
        endpointUrl
      );
      reply.send(connector);
    })
  );

  // Attach schema to connector
  fastify.put(
    "/connectors/:id/schema",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { inputSchemaId } = request.body as { inputSchemaId: string };

      // Check if connector exists
      const existingConnector = await ConnectorService.getConnectorById(id);
      if (!existingConnector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }

      const connector = await ConnectorService.attachSchemaToConnector(
        id,
        inputSchemaId
      );
      reply.send(connector);
    })
  );

  // Detach schema from connector
  fastify.delete(
    "/connectors/:id/schema",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      // Check if connector exists
      const existingConnector = await ConnectorService.getConnectorById(id);
      if (!existingConnector) {
        reply.code(404).send({ error: "Connector not found" });
        return;
      }

      const connector = await ConnectorService.detachSchemaFromConnector(id);
      reply.send(connector);
    })
  );
};
