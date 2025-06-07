/**
 * NOTE: UNDER CONSTRUCTION!
 * Auth is currently disabled and not used in the Data Service!
 *
 * TODO: Check the auth logic and apply it to the codebase!
 *
 * Authentication and Authorization System
 * Provides centralized security for the Data Service
 *
 * CONFIGURABLE: Can be disabled for internal service-to-service calls
 * when all services are co-located (Docker network isolation)
 */

import { FastifyRequest, FastifyReply } from "../deps";
import { ServiceError, UnauthorizedError, ForbiddenError } from "./errors";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "ADMIN" | "USER" | "VIEWER";
  projectIds: string[];
  permissions: string[];
}

export interface AuthContext {
  user: AuthenticatedUser;
  isAdmin: boolean;
  canAccessProject: (projectId: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

// Configuration for auth system
export interface AuthConfig {
  enabled: boolean;
  requireAuthForExternalAccess: boolean;
  allowInternalServiceCalls: boolean;
  internalServiceToken?: string;
  trustedNetworks?: string[];
}

// Default auth configuration based on environment
export const getAuthConfig = (): AuthConfig => {
  const isProduction = process.env.NODE_ENV === "production";
  const isDistributedDeployment = process.env.DISTRIBUTED_DEPLOYMENT === "true";

  return {
    // Auth enabled only for production or distributed deployments
    enabled:
      process.env.AUTH_ENABLED === "true" ||
      isProduction ||
      isDistributedDeployment,

    // Always require auth for external access
    requireAuthForExternalAccess: true,

    // Allow internal service calls in co-located deployments
    allowInternalServiceCalls: !isDistributedDeployment,

    // Internal service token for service-to-service auth
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN,

    // Trusted networks (Docker networks, local subnets)
    trustedNetworks: process.env.TRUSTED_NETWORKS?.split(",") || [
      "172.16.0.0/12", // Docker default network
      "10.0.0.0/8", // Private network
      "127.0.0.1/32", // Localhost
      "::1/128", // IPv6 localhost
    ],
  };
};

// Extend Fastify request to include auth context
declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
    isInternalCall?: boolean;
  }
}

/**
 * Check if request is from internal service (same Docker network)
 */
export const isInternalServiceCall = (request: FastifyRequest): boolean => {
  const config = getAuthConfig();

  if (!config.allowInternalServiceCalls) {
    return false;
  }

  // Check for internal service token
  if (config.internalServiceToken) {
    const token = extractToken(request);
    if (token === config.internalServiceToken) {
      return true;
    }
  }

  // Check if request comes from trusted network
  const clientIp = request.ip;
  const userAgent = request.headers["user-agent"];

  // Internal service calls typically have service-specific user agents
  if (
    userAgent &&
    (userAgent.includes("service-") ||
      userAgent.includes("internal-") ||
      userAgent.includes("docker-"))
  ) {
    return true;
  }

  // Check trusted networks
  if (config.trustedNetworks && clientIp) {
    // Simple IP check - in production use proper CIDR matching
    return config.trustedNetworks.some((network) => {
      if (network.includes("/")) {
        // CIDR notation - simplified check
        const [baseIp] = network.split("/");
        return clientIp.startsWith(
          baseIp.substring(0, baseIp.lastIndexOf("."))
        );
      }
      return clientIp === network;
    });
  }

  return false;
};

/**
 * Extract and validate authentication token from request
 */
export const extractToken = (request: FastifyRequest): string | null => {
  // Check Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check cookie (for web app sessions)
  const cookie = request.headers.cookie;
  if (cookie) {
    const sessionMatch = cookie.match(/session=([^;]+)/);
    if (sessionMatch) {
      return sessionMatch[1];
    }
  }

  // Check internal service header
  const internalToken = request.headers["x-internal-token"];
  if (internalToken && typeof internalToken === "string") {
    return internalToken;
  }

  // Check query parameter (for development/testing)
  if (
    process.env.NODE_ENV === "development" &&
    request.query &&
    typeof request.query === "object"
  ) {
    const query = request.query as any;
    if (query.token) {
      return query.token;
    }
  }

  return null;
};

/**
 * Validate authentication token and return user information
 */
export const validateToken = async (
  token: string
): Promise<AuthenticatedUser | null> => {
  try {
    const config = getAuthConfig();

    // Internal service token validation
    if (config.internalServiceToken && token === config.internalServiceToken) {
      return {
        id: "internal-service",
        email: "internal@service.local",
        role: "ADMIN",
        projectIds: [],
        permissions: ["*"], // Internal services have all permissions
      };
    }

    // Development token validation
    if (process.env.NODE_ENV === "development" && token === "dev-admin-token") {
      return {
        id: "dev-admin",
        email: "dev@example.com",
        role: "ADMIN",
        projectIds: [],
        permissions: ["*"],
      };
    }

    // TODO: Implement production token validation for external access
    // - JWT token verification
    // - Session store lookup
    // - User database query
    // - Project membership resolution
    // - Permission calculation

    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Create auth context from authenticated user
 */
export const createAuthContext = (user: AuthenticatedUser): AuthContext => {
  return {
    user,
    isAdmin: user.role === "ADMIN",
    canAccessProject: (projectId: string) => {
      return user.role === "ADMIN" || user.projectIds.includes(projectId);
    },
    hasPermission: (permission: string) => {
      return (
        user.role === "ADMIN" ||
        user.permissions.includes("*") ||
        user.permissions.includes(permission)
      );
    },
  };
};

/**
 * Create internal service context for bypassed auth
 */
export const createInternalServiceContext = (): AuthContext => {
  const internalUser: AuthenticatedUser = {
    id: "internal-service",
    email: "internal@service.local",
    role: "ADMIN",
    projectIds: [],
    permissions: ["*"],
  };

  return createAuthContext(internalUser);
};

/**
 * Flexible authentication middleware - respects auth configuration
 */
export const authenticateUser = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const config = getAuthConfig();

  // Check if auth is disabled
  if (!config.enabled) {
    request.auth = createInternalServiceContext();
    return;
  }

  // Check if this is an internal service call
  if (isInternalServiceCall(request)) {
    request.isInternalCall = true;
    request.auth = createInternalServiceContext();
    return;
  }

  // Require authentication for external calls
  const token = extractToken(request);

  if (!token) {
    throw UnauthorizedError("Authentication token required");
  }

  const user = await validateToken(token);

  if (!user) {
    throw UnauthorizedError("Invalid or expired authentication token");
  }

  request.auth = createAuthContext(user);
};

/**
 * Optional authentication - for endpoints that work with or without auth
 */
export const optionalAuth = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  const config = getAuthConfig();

  // Always set context if auth is disabled or internal call
  if (!config.enabled || isInternalServiceCall(request)) {
    request.isInternalCall = true;
    request.auth = createInternalServiceContext();
    return;
  }

  // Try to authenticate if token is present
  const token = extractToken(request);

  if (token) {
    const user = await validateToken(token);
    if (user) {
      request.auth = createAuthContext(user);
    }
  }
};

/**
 * Authorization helpers - respect internal service calls
 */
export const requirePermission = (permission: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Internal service calls bypass permission checks
    if (request.isInternalCall) {
      return;
    }

    if (!request.auth) {
      throw UnauthorizedError("Authentication required");
    }

    if (!request.auth.hasPermission(permission)) {
      throw ForbiddenError("resource", permission);
    }
  };
};

export const requireProjectAccess = (
  getProjectId: (request: FastifyRequest) => string
) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Internal service calls bypass project access checks
    if (request.isInternalCall) {
      return;
    }

    if (!request.auth) {
      throw UnauthorizedError("Authentication required");
    }

    const projectId = getProjectId(request);

    if (!request.auth.canAccessProject(projectId)) {
      throw ForbiddenError("project", "access");
    }
  };
};

export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Internal service calls bypass admin checks
  if (request.isInternalCall) {
    return;
  }

  if (!request.auth) {
    throw UnauthorizedError("Authentication required");
  }

  if (!request.auth.isAdmin) {
    throw ForbiddenError("admin resource", "access");
  }
};

/**
 * Auth configuration for different deployment modes
 */
export const AuthPatterns = {
  // For co-located services (current architecture)
  internal: {
    middleware: optionalAuth, // No strict auth required
    checkPermissions: false,
  },

  // For distributed services (future architecture)
  distributed: {
    middleware: authenticateUser, // Strict auth required
    checkPermissions: true,
  },

  // Current patterns based on config
  platformRoutes: {
    users: requirePermission("users:read"),
    projects: requirePermission("projects:read"),
    adminOnly: requireAdmin,
  },

  timescaleRoutes: {
    read: requirePermission("timescale:read"),
    write: requirePermission("timescale:write"),
  },

  storageRoutes: {
    read: requirePermission("storage:read"),
    write: requirePermission("storage:write"),
    admin: requirePermission("storage:admin"),
  },
};

/**
 * Environment configuration examples
 */
export const EnvExamples = {
  // Co-located services (current)
  colocated: `
# .env for co-located services
AUTH_ENABLED=false
DISTRIBUTED_DEPLOYMENT=false
INTERNAL_SERVICE_TOKEN=your-internal-token
TRUSTED_NETWORKS=172.16.0.0/12,10.0.0.0/8,127.0.0.1/32
  `,

  // Distributed services (future)
  distributed: `
# .env for distributed services
AUTH_ENABLED=true
DISTRIBUTED_DEPLOYMENT=true
INTERNAL_SERVICE_TOKEN=your-secure-internal-token
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
  `,
};

/**
 * Development utilities
 */
export const DevAuth = {
  generateDevToken: (
    role: "ADMIN" | "USER" | "VIEWER",
    projectIds: string[] = []
  ) => {
    if (process.env.NODE_ENV !== "development") {
      throw new Error("Dev tokens only available in development mode");
    }
    return `dev-${role.toLowerCase()}-${projectIds.join(",")}-${Date.now()}`;
  },

  createTestUser: (
    overrides: Partial<AuthenticatedUser> = {}
  ): AuthenticatedUser => {
    return {
      id: "test-user",
      email: "test@example.com",
      role: "USER",
      projectIds: [],
      permissions: ["projects:read", "timescale:read", "storage:read"],
      ...overrides,
    };
  },

  // Simulate internal service call
  simulateInternalCall: (request: FastifyRequest) => {
    request.headers["user-agent"] = "internal-service-client";
    request.headers["x-internal-token"] =
      process.env.INTERNAL_SERVICE_TOKEN || "dev-internal-token";
  },
};
