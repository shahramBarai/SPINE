import { platformDb } from "../../db/platform";
import {
  EntityNotFoundError,
  ConflictError,
  ValidationError,
  DatabaseError,
} from "../../utils/errors";

export interface CreatePipelineData {
  name: string;
  description?: string;
  projectId: string;
  isActive?: boolean;
  config: any;
  createdBy: string;
  editedBy: string;
}

export interface UpdatePipelineData {
  name?: string;
  description?: string;
  flinkJobId?: string;
  isActive?: boolean;
  version?: number;
}

export class PipelineService {
  // Get all pipelines
  static async getAllPipelines() {
    try {
      return await platformDb.pipeline.findMany({
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("getAllPipelines", error);
    }
  }

  // Get pipeline by id
  static async getPipelineById(id: string) {
    if (!id) {
      throw ValidationError("id", "Pipeline ID is required");
    }

    try {
      const pipeline = await platformDb.pipeline.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!pipeline) {
        throw EntityNotFoundError("Pipeline", id);
      }

      return pipeline;
    } catch (error: any) {
      if (error.name === "ServiceError") {
        throw error;
      }
      throw DatabaseError("getPipelineById", error);
    }
  }

  // Get pipelines by project
  static async getPipelinesByProject(projectId: string) {
    if (!projectId) {
      throw ValidationError("projectId", "Project ID is required");
    }

    try {
      return await platformDb.pipeline.findMany({
        where: { projectId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("getPipelinesByProject", error);
    }
  }

  // Create pipeline
  static async createPipeline(data: CreatePipelineData) {
    if (!data.name) {
      throw ValidationError("name", "Pipeline name is required");
    }
    if (!data.projectId) {
      throw ValidationError("projectId", "Project ID is required");
    }

    try {
      return await platformDb.pipeline.create({
        data: {
          name: data.name,
          description: data.description,
          projectId: data.projectId,
          isActive: data.isActive || false,
          version: 1,
          config: data.config,
          createdBy: data.createdBy,
          editedBy: data.editedBy,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("createPipeline", error);
    }
  }

  // Update pipeline
  static async updatePipeline(id: string, data: UpdatePipelineData) {
    if (!id) {
      throw ValidationError("id", "Pipeline ID is required");
    }

    // Check if pipeline exists
    await this.getPipelineById(id); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.pipeline.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("updatePipeline", error);
    }
  }

  // Delete pipeline
  static async deletePipeline(id: string) {
    if (!id) {
      throw ValidationError("id", "Pipeline ID is required");
    }

    // Check if pipeline exists
    await this.getPipelineById(id); // This will throw EntityNotFoundError if not found

    try {
      return await platformDb.pipeline.delete({
        where: { id },
      });
    } catch (error: any) {
      throw DatabaseError("deletePipeline", error);
    }
  }

  // Activate pipeline
  static async activatePipeline(id: string, userId: string) {
    if (!id) {
      throw ValidationError("id", "Pipeline ID is required");
    }
    if (!userId) {
      throw ValidationError("userId", "User ID is required");
    }

    // Check if pipeline exists
    const pipeline = await this.getPipelineById(id);

    if (pipeline.isActive) {
      throw ConflictError("Pipeline", "Pipeline is already active");
    }

    try {
      return await platformDb.pipeline.update({
        where: { id },
        data: {
          isActive: true,
          updatedAt: new Date(),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("activatePipeline", error);
    }
  }

  // Deactivate pipeline
  static async deactivatePipeline(id: string, userId: string) {
    if (!id) {
      throw ValidationError("id", "Pipeline ID is required");
    }
    if (!userId) {
      throw ValidationError("userId", "User ID is required");
    }

    // Check if pipeline exists
    const pipeline = await this.getPipelineById(id);

    if (!pipeline.isActive) {
      throw ConflictError("Pipeline", "Pipeline is already inactive");
    }

    try {
      return await platformDb.pipeline.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("deactivatePipeline", error);
    }
  }

  // Increment pipeline version
  static async incrementPipelineVersion(id: string) {
    if (!id) {
      throw ValidationError("id", "Pipeline ID is required");
    }

    // Check if pipeline exists
    const pipeline = await this.getPipelineById(id);

    try {
      return await platformDb.pipeline.update({
        where: { id },
        data: {
          version: pipeline.version + 1,
          updatedAt: new Date(),
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("incrementPipelineVersion", error);
    }
  }

  // Check if pipeline exists
  static async pipelineExists(id: string): Promise<boolean> {
    if (!id) {
      return false;
    }

    try {
      const pipeline = await platformDb.pipeline.findUnique({
        where: { id },
        select: { id: true },
      });
      return !!pipeline;
    } catch (error: any) {
      throw DatabaseError("pipelineExists", error);
    }
  }

  // Get active pipelines
  static async getActivePipelines() {
    try {
      return await platformDb.pipeline.findMany({
        where: { isActive: true },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      throw DatabaseError("getActivePipelines", error);
    }
  }
}
