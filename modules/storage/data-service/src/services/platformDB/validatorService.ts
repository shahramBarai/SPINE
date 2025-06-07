import { platformDb } from "../../db/platform";
import { ErrorStrategy } from "generated/platform";

export interface CreateValidatorData {
  sourceTopicName: string;
  targetTopicName: string;
  schemaId: string;
  errorStrategy?: ErrorStrategy;
  errorTopic?: string;
}

export interface UpdateValidatorData {
  sourceTopicName?: string;
  targetTopicName?: string;
  schemaId?: string;
  errorStrategy?: ErrorStrategy;
  errorTopic?: string;
}

export class ValidatorService {
  // Get all validators
  static async getAllValidators() {
    return platformDb.validator.findMany({
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validator by id
  static async getValidatorById(id: string) {
    return platformDb.validator.findUnique({
      where: { id },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators by source topic
  static async getValidatorsBySourceTopic(sourceTopicName: string) {
    return platformDb.validator.findMany({
      where: { sourceTopicName },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators by target topic
  static async getValidatorsByTargetTopic(targetTopicName: string) {
    return platformDb.validator.findMany({
      where: { targetTopicName },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators by schema
  static async getValidatorsBySchema(schemaId: string) {
    return platformDb.validator.findMany({
      where: { schemaId },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators by error strategy
  static async getValidatorsByErrorStrategy(errorStrategy: ErrorStrategy) {
    return platformDb.validator.findMany({
      where: { errorStrategy },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Create validator
  static async createValidator(data: CreateValidatorData) {
    return platformDb.validator.create({
      data: {
        sourceTopicName: data.sourceTopicName,
        targetTopicName: data.targetTopicName,
        schemaId: data.schemaId,
        errorStrategy: data.errorStrategy || ErrorStrategy.REDIRECT,
        errorTopic: data.errorTopic,
      },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Update validator
  static async updateValidator(id: string, data: UpdateValidatorData) {
    return platformDb.validator.update({
      where: { id },
      data,
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Delete validator
  static async deleteValidator(id: string) {
    return platformDb.validator.delete({
      where: { id },
    });
  }

  // Get validators with LOG error strategy
  static async getLogValidators() {
    return platformDb.validator.findMany({
      where: { errorStrategy: ErrorStrategy.LOG },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators with DROP error strategy
  static async getDropValidators() {
    return platformDb.validator.findMany({
      where: { errorStrategy: ErrorStrategy.DROP },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators with REDIRECT error strategy
  static async getRedirectValidators() {
    return platformDb.validator.findMany({
      where: { errorStrategy: ErrorStrategy.REDIRECT },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validators with error topics
  static async getValidatorsWithErrorTopics() {
    return platformDb.validator.findMany({
      where: {
        errorTopic: {
          not: null,
        },
      },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Update validator error strategy
  static async updateValidatorErrorStrategy(
    id: string,
    errorStrategy: ErrorStrategy,
    errorTopic?: string
  ) {
    return platformDb.validator.update({
      where: { id },
      data: {
        errorStrategy,
        errorTopic,
      },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Check if validator exists for topic pair
  static async validatorExistsForTopics(
    sourceTopicName: string,
    targetTopicName: string
  ) {
    const validator = await platformDb.validator.findFirst({
      where: {
        sourceTopicName,
        targetTopicName,
      },
      select: { id: true },
    });
    return !!validator;
  }

  // Get validation chain for a topic
  static async getValidationChain(topicName: string) {
    // Get validators where this topic is a source
    const downstreamValidators = await platformDb.validator.findMany({
      where: { sourceTopicName: topicName },
      include: {
        targetTopic: true,
        schema: true,
      },
    });

    // Get validators where this topic is a target
    const upstreamValidators = await platformDb.validator.findMany({
      where: { targetTopicName: topicName },
      include: {
        sourceTopic: true,
        schema: true,
      },
    });

    return {
      upstream: upstreamValidators,
      downstream: downstreamValidators,
    };
  }

  // Get all validators for a specific error topic
  static async getValidatorsByErrorTopic(errorTopic: string) {
    return platformDb.validator.findMany({
      where: { errorTopic },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Update validator schema
  static async updateValidatorSchema(id: string, schemaId: string) {
    return platformDb.validator.update({
      where: { id },
      data: { schemaId },
      include: {
        sourceTopic: true,
        targetTopic: true,
        schema: true,
      },
    });
  }

  // Get validator statistics
  static async getValidatorStatistics() {
    const total = await platformDb.validator.count();

    const byErrorStrategy = await platformDb.validator.groupBy({
      by: ["errorStrategy"],
      _count: true,
    });

    const withErrorTopics = await platformDb.validator.count({
      where: {
        errorTopic: {
          not: null,
        },
      },
    });

    return {
      total,
      byErrorStrategy: byErrorStrategy.reduce((acc, item) => {
        acc[item.errorStrategy] = item._count;
        return acc;
      }, {} as Record<ErrorStrategy, number>),
      withErrorTopics,
      withoutErrorTopics: total - withErrorTopics,
    };
  }
}
