import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  KafkaTopicService,
  CreateKafkaTopicData,
  UpdateKafkaTopicData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";
import { TopicStage, DataFormat } from "generated/platform";

export const kafkaTopicRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all topics
  fastify.get(
    "/kafka-topics",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const topics = await KafkaTopicService.getAllKafkaTopics();
      reply.send(topics);
    })
  );

  // Get topic by name
  fastify.get(
    "/kafka-topics/:name",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { name } = request.params as { name: string };
      const topic = await KafkaTopicService.getKafkaTopicByName(name);
      if (!topic) {
        reply.code(404).send({ error: "Topic not found" });
        return;
      }
      reply.send(topic);
    })
  );

  // Get Kafka topics by stage
  fastify.get(
    "/kafka-topics/stage/:stage",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { stage } = request.params as { stage: TopicStage };
      const topics = await KafkaTopicService.getKafkaTopicsByStage(stage);
      reply.send(topics);
    })
  );

  // Get Kafka topics by data format
  fastify.get(
    "/kafka-topics/format/:dataFormat",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { dataFormat } = request.params as { dataFormat: DataFormat };
      const topics = await KafkaTopicService.getKafkaTopicsByDataFormat(
        dataFormat
      );
      reply.send(topics);
    })
  );

  // Get topics with schemas
  fastify.get(
    "/kafka-topics/with-schemas",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const topics = await KafkaTopicService.getTopicsWithSchemas();
      reply.send(topics);
    })
  );

  // Get topics without schemas
  fastify.get(
    "/kafka-topics/without-schemas",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const topics = await KafkaTopicService.getTopicsWithoutSchemas();
      reply.send(topics);
    })
  );

  // Create topic
  fastify.post(
    "/kafka-topics",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreateKafkaTopicData;
      const topic = await KafkaTopicService.createKafkaTopic(data);
      reply.code(201).send(topic);
    })
  );

  // Update topic
  fastify.put(
    "/kafka-topics/:name",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { name } = request.params as { name: string };
      const data = request.body as UpdateKafkaTopicData;

      // Check if topic exists
      const existingTopic = await KafkaTopicService.getKafkaTopicByName(name);
      if (!existingTopic) {
        reply.code(404).send({ error: "Topic not found" });
        return;
      }

      const topic = await KafkaTopicService.updateKafkaTopic(name, data);
      reply.send(topic);
    })
  );

  // Delete topic
  fastify.delete(
    "/kafka-topics/:name",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { name } = request.params as { name: string };

      // Check if topic exists
      const existingTopic = await KafkaTopicService.getKafkaTopicByName(name);
      if (!existingTopic) {
        reply.code(404).send({ error: "Topic not found" });
        return;
      }

      await KafkaTopicService.deleteKafkaTopic(name);
      reply.code(204).send();
    })
  );

  // Attach schema to topic
  fastify.put(
    "/kafka-topics/:topicName/schema",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };
      const { schemaId } = request.body as { schemaId: string };

      // Check if topic exists
      const existingTopic = await KafkaTopicService.getKafkaTopicByName(
        topicName
      );
      if (!existingTopic) {
        reply.code(404).send({ error: "Kafka topic not found" });
        return;
      }

      const topic = await KafkaTopicService.attachSchemaToTopic(
        topicName,
        schemaId
      );
      reply.send(topic);
    })
  );

  // Detach schema from topic
  fastify.delete(
    "/kafka-topics/:topicName/schema",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };

      // Check if topic exists
      const existingTopic = await KafkaTopicService.getKafkaTopicByName(
        topicName
      );
      if (!existingTopic) {
        reply.code(404).send({ error: "Kafka topic not found" });
        return;
      }

      const topic = await KafkaTopicService.detachSchemaFromTopic(topicName);
      reply.send(topic);
    })
  );

  // Get topic connectors
  fastify.get(
    "/kafka-topics/:topicName/connectors",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };
      const connectors = await KafkaTopicService.getTopicConnectors(topicName);
      reply.send(connectors);
    })
  );

  // Get topic validators
  fastify.get(
    "/kafka-topics/:topicName/validators",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };
      const validators = await KafkaTopicService.getTopicValidators(topicName);
      reply.send(validators);
    })
  );
};
