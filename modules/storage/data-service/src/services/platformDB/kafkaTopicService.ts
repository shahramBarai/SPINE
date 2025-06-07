import { platformDb } from "../../db/platform";
import {
  EntityNotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError,
} from "../../utils/errors";
import { TopicStage, DataFormat } from "generated/platform";

export interface CreateKafkaTopicData {
  topicName: string;
  description?: string;
  stage: TopicStage;
  dataFormat?: DataFormat;
  schemaId?: string;
}

export interface UpdateKafkaTopicData {
  topicName?: string;
  description?: string;
  stage?: TopicStage;
  dataFormat?: DataFormat;
  schemaId?: string;
}

export class KafkaTopicService {
  // Get all Kafka topics
  static async getAllKafkaTopics() {
    try {
      return await platformDb.kafkaTopic.findMany({
        include: {
          schema: true,
          connectors: true,
          sourceValidators: true,
          targetValidators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("getAllKafkaTopics", error);
    }
  }

  // Get Kafka topic by name
  static async getKafkaTopicByName(name: string) {
    if (!name) {
      throw ValidationError("name", "Topic name is required");
    }

    try {
      const topic = await platformDb.kafkaTopic.findUnique({
        where: { topicName: name },
        include: {
          schema: true,
          connectors: true,
          sourceValidators: true,
          targetValidators: true,
        },
      });

      if (!topic) {
        throw EntityNotFoundError("KafkaTopic", name);
      }

      return topic;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getKafkaTopicByName", error);
    }
  }

  // Get Kafka topics by stage
  static async getKafkaTopicsByStage(stage: TopicStage) {
    return platformDb.kafkaTopic.findMany({
      where: { stage },
      include: {
        schema: true,
        connectors: true,
      },
    });
  }

  // Get Kafka topics by data format
  static async getKafkaTopicsByDataFormat(dataFormat: DataFormat) {
    return platformDb.kafkaTopic.findMany({
      where: { dataFormat },
      include: {
        schema: true,
        connectors: true,
      },
    });
  }

  // Create Kafka topic
  static async createKafkaTopic(data: CreateKafkaTopicData) {
    if (!data.topicName) {
      throw ValidationError("topicName", "Topic name is required");
    }
    if (!data.stage) {
      throw ValidationError("stage", "Topic stage is required");
    }
    if (!data.dataFormat) {
      throw ValidationError("dataFormat", "Topic data format is required");
    }

    // Check if topic already exists
    const existingTopic = await this.kafkaTopicExists(data.topicName);
    if (existingTopic) {
      throw ConflictError("KafkaTopic", "Topic with this name already exists");
    }

    try {
      return await platformDb.kafkaTopic.create({
        data: {
          topicName: data.topicName,
          description: data.description,
          stage: data.stage,
          dataFormat: data.dataFormat,
          schemaId: data.schemaId,
        },
        include: {
          schema: true,
          connectors: true,
          sourceValidators: true,
          targetValidators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("createKafkaTopic", error);
    }
  }

  // Update Kafka topic
  static async updateKafkaTopic(name: string, data: UpdateKafkaTopicData) {
    if (!name) {
      throw ValidationError("name", "Topic name is required");
    }

    // Check if topic exists
    await this.getKafkaTopicByName(name); // This will throw EntityNotFoundError if not found

    // If name is being changed, check if new name is already taken
    if (data.topicName && data.topicName !== name) {
      const nameExists = await this.kafkaTopicExists(data.topicName);
      if (nameExists) {
        throw ConflictError("KafkaTopic", "Topic name already taken");
      }
    }

    try {
      return await platformDb.kafkaTopic.update({
        where: { topicName: name },
        data: {
          ...data,
        },
        include: {
          schema: true,
          connectors: true,
          sourceValidators: true,
          targetValidators: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("updateKafkaTopic", error);
    }
  }

  // Delete Kafka topic
  static async deleteKafkaTopic(name: string) {
    if (!name) {
      throw ValidationError("name", "Topic name is required");
    }

    // Check if topic exists
    await this.getKafkaTopicByName(name); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.kafkaTopic.delete({
        where: { topicName: name },
      });
    } catch (error: any) {
      throw DatabaseError("deleteKafkaTopic", error);
    }
  }

  // Attach schema to topic
  static async attachSchemaToTopic(topicName: string, schemaId: string) {
    if (!topicName) {
      throw ValidationError("topicName", "Topic name is required");
    }
    if (!schemaId) {
      throw ValidationError("schemaId", "Schema ID is required");
    }

    // Check if topic exists
    await this.getKafkaTopicByName(topicName); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.kafkaTopic.update({
        where: { topicName: topicName },
        data: {
          schemaId,
        },
        include: {
          schema: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("attachSchemaToTopic", error);
    }
  }

  // Detach schema from topic
  static async detachSchemaFromTopic(topicName: string) {
    if (!topicName) {
      throw ValidationError("topicName", "Topic name is required");
    }

    // Check if topic exists
    await this.getKafkaTopicByName(topicName); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.kafkaTopic.update({
        where: { topicName: topicName },
        data: {
          schemaId: null,
        },
        include: {
          schema: true,
        },
      });
    } catch (error: any) {
      throw DatabaseError("detachSchemaFromTopic", error);
    }
  }

  // Get topics with schemas
  static async getTopicsWithSchemas() {
    return platformDb.kafkaTopic.findMany({
      where: {
        schemaId: {
          not: null,
        },
      },
      include: {
        schema: true,
      },
    });
  }

  // Get topics without schemas
  static async getTopicsWithoutSchemas() {
    return platformDb.kafkaTopic.findMany({
      where: {
        schemaId: null,
      },
    });
  }

  // Check if topic exists
  static async kafkaTopicExists(name: string): Promise<boolean> {
    if (!name) {
      return false;
    }

    try {
      const topic = await platformDb.kafkaTopic.findUnique({
        where: { topicName: name },
        select: { topicName: true },
      });
      return !!topic;
    } catch (error: any) {
      throw DatabaseError("kafkaTopicExists", error);
    }
  }

  // Get topic connectors
  static async getTopicConnectors(topicName: string) {
    return platformDb.connectorConfig.findMany({
      where: { kafkaTopicName: topicName },
      include: {
        inputSchema: true,
      },
    });
  }

  // Get topic validators (source and target)
  static async getTopicValidators(topicName: string) {
    const sourceValidators = await platformDb.validator.findMany({
      where: { sourceTopicName: topicName },
      include: {
        schema: true,
        targetTopic: true,
      },
    });

    const targetValidators = await platformDb.validator.findMany({
      where: { targetTopicName: topicName },
      include: {
        schema: true,
        sourceTopic: true,
      },
    });

    return {
      sourceValidators,
      targetValidators,
    };
  }
}
