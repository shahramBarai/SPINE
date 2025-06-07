import { platformDb } from "../../db/platform";
import { ConnectorType } from "generated/platform";

export interface CreateConnectorConfigData {
  connectorName: string;
  connectorType: ConnectorType;
  endpointUrl: string;
  kafkaTopicName: string;
  inputSchemaId?: string;
  config?: any;
}

export interface UpdateConnectorConfigData {
  connectorName?: string;
  connectorType?: ConnectorType;
  endpointUrl?: string;
  kafkaTopicName?: string;
  inputSchemaId?: string;
  config?: any;
}

export class ConnectorService {
  // Get all connectors
  static async getAllConnectors() {
    return platformDb.connectorConfig.findMany({
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get connector by id
  static async getConnectorById(id: string) {
    return platformDb.connectorConfig.findUnique({
      where: { id },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get connector by name
  static async getConnectorByName(connectorName: string) {
    return platformDb.connectorConfig.findUnique({
      where: { connectorName },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get connectors by type
  static async getConnectorsByType(connectorType: ConnectorType) {
    return platformDb.connectorConfig.findMany({
      where: { connectorType },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get connectors by Kafka topic
  static async getConnectorsByKafkaTopic(kafkaTopicName: string) {
    return platformDb.connectorConfig.findMany({
      where: { kafkaTopicName },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get connectors by schema
  static async getConnectorsBySchema(inputSchemaId: string) {
    return platformDb.connectorConfig.findMany({
      where: { inputSchemaId },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Create connector
  static async createConnector(data: CreateConnectorConfigData) {
    return platformDb.connectorConfig.create({
      data: {
        connectorName: data.connectorName,
        connectorType: data.connectorType,
        endpointUrl: data.endpointUrl,
        kafkaTopicName: data.kafkaTopicName,
        inputSchemaId: data.inputSchemaId,
        config: data.config,
      },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Update connector
  static async updateConnector(id: string, data: UpdateConnectorConfigData) {
    return platformDb.connectorConfig.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Delete connector
  static async deleteConnector(id: string) {
    return platformDb.connectorConfig.delete({
      where: { id },
    });
  }

  // Check if connector exists by name
  static async connectorExists(connectorName: string) {
    const connector = await platformDb.connectorConfig.findUnique({
      where: { connectorName },
      select: { id: true },
    });
    return !!connector;
  }

  // Get MQTT connectors
  static async getMqttConnectors() {
    return platformDb.connectorConfig.findMany({
      where: { connectorType: ConnectorType.MQTT },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get REST connectors
  static async getRestConnectors() {
    return platformDb.connectorConfig.findMany({
      where: { connectorType: ConnectorType.REST },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get input connectors
  static async getInputConnectors() {
    return platformDb.connectorConfig.findMany({
      where: { connectorType: ConnectorType.INPUT_CONNECTOR },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Update connector configuration
  static async updateConnectorConfig(id: string, config: any) {
    return platformDb.connectorConfig.update({
      where: { id },
      data: {
        config,
        updatedAt: new Date(),
      },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Attach schema to connector
  static async attachSchemaToConnector(id: string, inputSchemaId: string) {
    return platformDb.connectorConfig.update({
      where: { id },
      data: {
        inputSchemaId,
        updatedAt: new Date(),
      },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Detach schema from connector
  static async detachSchemaFromConnector(id: string) {
    return platformDb.connectorConfig.update({
      where: { id },
      data: {
        inputSchemaId: null,
        updatedAt: new Date(),
      },
      include: {
        kafkaTopic: true,
      },
    });
  }

  // Get connectors with schemas
  static async getConnectorsWithSchemas() {
    return platformDb.connectorConfig.findMany({
      where: {
        inputSchemaId: {
          not: null,
        },
      },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }

  // Get connectors without schemas
  static async getConnectorsWithoutSchemas() {
    return platformDb.connectorConfig.findMany({
      where: {
        inputSchemaId: null,
      },
      include: {
        kafkaTopic: true,
      },
    });
  }

  // Update connector endpoint
  static async updateConnectorEndpoint(id: string, endpointUrl: string) {
    return platformDb.connectorConfig.update({
      where: { id },
      data: {
        endpointUrl,
        updatedAt: new Date(),
      },
      include: {
        kafkaTopic: true,
        inputSchema: true,
      },
    });
  }
}
