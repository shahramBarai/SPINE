/**
 * Standardized Error Handling System
 * Provides consistent error responses across all Data Service APIs
 */

export type ServiceErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "DATABASE_ERROR"
  | "EXTERNAL_SERVICE_ERROR";

export class ServiceError extends Error {
  constructor(
    public code: ServiceErrorCode,
    message: string,
    public details?: any,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ServiceError";

    // Set default status codes
    if (!statusCode) {
      this.statusCode = this.getDefaultStatusCode(code);
    }
  }

  private getDefaultStatusCode(code: ServiceErrorCode): number {
    const statusCodeMap: Record<ServiceErrorCode, number> = {
      NOT_FOUND: 404,
      VALIDATION_ERROR: 400,
      CONFLICT: 409,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      INTERNAL_ERROR: 500,
      DATABASE_ERROR: 503,
      EXTERNAL_SERVICE_ERROR: 502,
    };
    return statusCodeMap[code];
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }
}

// Common error factory functions
export const EntityNotFoundError = (
  entity: string,
  identifier: string | number
) =>
  new ServiceError("NOT_FOUND", `${entity} with ID ${identifier} not found`, {
    entity,
    identifier,
  });

export const ValidationError = (field: string, reason: string, value?: any) =>
  new ServiceError(
    "VALIDATION_ERROR",
    `Validation failed for ${field}: ${reason}`,
    { field, reason, value }
  );

export const ConflictError = (entity: string, reason: string) =>
  new ServiceError("CONFLICT", `${entity} conflict: ${reason}`, {
    entity,
    reason,
  });

export const DatabaseError = (operation: string, error: any) =>
  new ServiceError(
    "DATABASE_ERROR",
    `Database operation failed: ${operation}`,
    { operation, originalError: error.message }
  );

export const UnauthorizedError = (reason?: string) =>
  new ServiceError("UNAUTHORIZED", reason || "Authentication required");

export const ForbiddenError = (resource: string, action: string) =>
  new ServiceError("FORBIDDEN", `Access denied: cannot ${action} ${resource}`);

// Error response formatter for Fastify routes
export interface ErrorResponse {
  error: string;
  code: ServiceErrorCode;
  details?: any;
  timestamp: string;
}

export const formatErrorResponse = (
  error: unknown
): { statusCode: number; response: ErrorResponse } => {
  if (error instanceof ServiceError) {
    return {
      statusCode: error.statusCode || 500,
      response: error.toJSON(),
    };
  }

  // Handle Prisma errors
  if (error && typeof error === "object" && "code" in error) {
    const prismaError = error as any;

    switch (prismaError.code) {
      case "P2002":
        return {
          statusCode: 409,
          response: {
            error: "Unique constraint violation",
            code: "CONFLICT",
            details: prismaError.meta,
            timestamp: new Date().toISOString(),
          },
        };
      case "P2025":
        return {
          statusCode: 404,
          response: {
            error: "Record not found",
            code: "NOT_FOUND",
            details: prismaError.meta,
            timestamp: new Date().toISOString(),
          },
        };
      default:
        return {
          statusCode: 500,
          response: {
            error: "Database operation failed",
            code: "DATABASE_ERROR",
            details: { prismaCode: prismaError.code },
            timestamp: new Date().toISOString(),
          },
        };
    }
  }

  // Handle unknown errors
  return {
    statusCode: 500,
    response: {
      error: error instanceof Error ? error.message : "Internal server error",
      code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString(),
    },
  };
};

// Fastify error handler plugin
export const errorHandlerPlugin = async (fastify: any) => {
  fastify.setErrorHandler((error: unknown, request: any, reply: any) => {
    const { statusCode, response } = formatErrorResponse(error);

    // Log errors for monitoring
    if (statusCode >= 500) {
      fastify.log.error(
        {
          error,
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers,
            params: request.params,
            query: request.query,
          },
        },
        "Internal server error occurred"
      );
    } else if (statusCode >= 400) {
      fastify.log.warn(
        {
          error: response,
          request: {
            method: request.method,
            url: request.url,
            params: request.params,
            query: request.query,
          },
        },
        "Client error occurred"
      );
    }

    reply.code(statusCode).send(response);
  });
};

// Async wrapper for route handlers to automatically catch and format errors
export const asyncHandler = (fn: Function) => {
  return async (request: any, reply: any) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      const { statusCode, response } = formatErrorResponse(error);
      reply.code(statusCode).send(response);
    }
  };
};

// Helper function to handle service errors in controllers
export const handleServiceError = (error: unknown, reply: any) => {
  const { statusCode, response } = formatErrorResponse(error);
  return reply.code(statusCode).send(response);
};
