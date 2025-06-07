import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "../../deps";
import {
  ValidatorService,
  CreateValidatorData,
  UpdateValidatorData,
} from "../../services/platformDB";
import { asyncHandler } from "../../utils/errors";
import { ErrorStrategy } from "generated/platform";

export const validatorRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Get all validators
  fastify.get(
    "/validators",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const validators = await ValidatorService.getAllValidators();
      reply.send(validators);
    })
  );

  // Get validator by id
  fastify.get(
    "/validators/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const validator = await ValidatorService.getValidatorById(id);
      if (!validator) {
        reply.code(404).send({ error: "Validator not found" });
        return;
      }
      reply.send(validator);
    })
  );

  // Get validators by source topic
  fastify.get(
    "/validators/source/:topicName",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };
      const validators = await ValidatorService.getValidatorsBySourceTopic(
        topicName
      );
      reply.send(validators);
    })
  );

  // Get validators by target topic
  fastify.get(
    "/validators/target/:topicName",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };
      const validators = await ValidatorService.getValidatorsByTargetTopic(
        topicName
      );
      reply.send(validators);
    })
  );

  // Get validators by schema
  fastify.get(
    "/validators/schema/:schemaId",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { schemaId } = request.params as { schemaId: string };
      const validators = await ValidatorService.getValidatorsBySchema(schemaId);
      reply.send(validators);
    })
  );

  // Get validators by error strategy
  fastify.get(
    "/validators/error-strategy/:errorStrategy",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { errorStrategy } = request.params as {
        errorStrategy: ErrorStrategy;
      };
      const validators = await ValidatorService.getValidatorsByErrorStrategy(
        errorStrategy
      );
      reply.send(validators);
    })
  );

  // Get validators by error topic
  fastify.get(
    "/validators/error-topic/:errorTopic",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { errorTopic } = request.params as { errorTopic: string };
      const validators = await ValidatorService.getValidatorsByErrorTopic(
        errorTopic
      );
      reply.send(validators);
    })
  );

  // Get LOG validators
  fastify.get("/validators/log", async (request, reply) => {
    try {
      const validators = await ValidatorService.getLogValidators();
      reply.send(validators);
    } catch (error: any) {
      reply.code(500).send({ error: "Failed to fetch LOG validators" });
    }
  });

  // Get DROP validators
  fastify.get("/validators/drop", async (request, reply) => {
    try {
      const validators = await ValidatorService.getDropValidators();
      reply.send(validators);
    } catch (error: any) {
      reply.code(500).send({ error: "Failed to fetch DROP validators" });
    }
  });

  // Get REDIRECT validators
  fastify.get(
    "/validators/redirect",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const validators = await ValidatorService.getRedirectValidators();
      reply.send(validators);
    })
  );

  // Get validators with error topics
  fastify.get(
    "/validators/with-error-topics",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const validators = await ValidatorService.getValidatorsWithErrorTopics();
      reply.send(validators);
    })
  );

  // Get validation chain for a topic
  fastify.get(
    "/validators/chain/:topicName",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { topicName } = request.params as { topicName: string };
      const chain = await ValidatorService.getValidationChain(topicName);
      reply.send(chain);
    })
  );

  // Get validator statistics
  fastify.get(
    "/validators/statistics",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const statistics = await ValidatorService.getValidatorStatistics();
      reply.send(statistics);
    })
  );

  // Create validator
  fastify.post(
    "/validators",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as CreateValidatorData;

      // Check if validator already exists for this topic pair
      const validatorExists = await ValidatorService.validatorExistsForTopics(
        data.sourceTopicName,
        data.targetTopicName
      );
      if (validatorExists) {
        reply
          .code(409)
          .send({ error: "Validator already exists for this topic pair" });
        return;
      }

      const validator = await ValidatorService.createValidator(data);
      reply.code(201).send(validator);
    })
  );

  // Update validator
  fastify.put(
    "/validators/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const data = request.body as UpdateValidatorData;

      // Check if validator exists
      const existingValidator = await ValidatorService.getValidatorById(id);
      if (!existingValidator) {
        reply.code(404).send({ error: "Validator not found" });
        return;
      }

      const validator = await ValidatorService.updateValidator(id, data);
      reply.send(validator);
    })
  );

  // Delete validator
  fastify.delete(
    "/validators/:id",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      // Check if validator exists
      const existingValidator = await ValidatorService.getValidatorById(id);
      if (!existingValidator) {
        reply.code(404).send({ error: "Validator not found" });
        return;
      }

      await ValidatorService.deleteValidator(id);
      reply.code(204).send();
    })
  );

  // Update validator error strategy
  fastify.put(
    "/validators/:id/error-strategy",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { errorStrategy, errorTopic } = request.body as {
        errorStrategy: ErrorStrategy;
        errorTopic?: string;
      };

      // Check if validator exists
      const existingValidator = await ValidatorService.getValidatorById(id);
      if (!existingValidator) {
        reply.code(404).send({ error: "Validator not found" });
        return;
      }

      const validator = await ValidatorService.updateValidatorErrorStrategy(
        id,
        errorStrategy,
        errorTopic
      );
      reply.send(validator);
    })
  );

  // Update validator schema
  fastify.put(
    "/validators/:id/schema",
    asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { schemaId } = request.body as { schemaId: string };

      // Check if validator exists
      const existingValidator = await ValidatorService.getValidatorById(id);
      if (!existingValidator) {
        reply.code(404).send({ error: "Validator not found" });
        return;
      }

      const validator = await ValidatorService.updateValidatorSchema(
        id,
        schemaId
      );
      reply.send(validator);
    })
  );
};
