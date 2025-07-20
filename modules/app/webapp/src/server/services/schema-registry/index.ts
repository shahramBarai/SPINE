import { TRPCError } from "@trpc/server";

interface SchemaRegistryConfig {
  url: string;
  auth?: {
    username: string;
    password: string;
  };
}

interface SchemaSubject {
  subject: string;
  latestVersion: number;
  schemaType: "AVRO" | "JSON" | "PROTOBUF";
  compatibility:
    | "NONE"
    | "BACKWARD"
    | "FORWARD"
    | "FULL"
    | "BACKWARD_TRANSITIVE"
    | "FORWARD_TRANSITIVE"
    | "FULL_TRANSITIVE";
  versions: number[];
}

interface SchemaVersion {
  id: number;
  version: number;
  schema: string;
  subject: string;
  schemaType: "AVRO" | "JSON" | "PROTOBUF";
  references?: unknown[];
}

interface SchemaFilters {
  search?: string;
  schemaType?: "AVRO" | "JSON" | "PROTOBUF";
  topic?: string;
}

interface RegisterSchemaRequest {
  schema: string;
  schemaType?: "AVRO" | "JSON" | "PROTOBUF";
  references?: unknown[];
}

interface RegisterSchemaResponse {
  id: number;
}

interface CompatibilityCheckResponse {
  is_compatible: boolean;
  messages?: string[];
}

export class SchemaRegistryService {
  private config: SchemaRegistryConfig;

  constructor(config: SchemaRegistryConfig) {
    this.config = config;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.url}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/vnd.schemaregistry.v1+json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.config.auth) {
      const encoded = Buffer.from(
        `${this.config.auth.username}:${this.config.auth.password}`
      ).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error" }));
      throw new TRPCError({
        code: response.status >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
        message:
          errorData.message || `Schema Registry error: ${response.status}`,
        cause: errorData,
      });
    }

    return response.json();
  }

  async listSubjects(filters?: SchemaFilters): Promise<SchemaSubject[]> {
    try {
      // Get all subjects
      const subjects: string[] = await this.makeRequest("/subjects");

      // Get details for each subject
      const subjectDetails = await Promise.all(
        subjects.map(async (subject) => {
          try {
            // Get latest version
            const latestVersion: SchemaVersion = await this.makeRequest(
              `/subjects/${encodeURIComponent(subject)}/versions/latest`
            );

            // Get all versions
            const versions: number[] = await this.makeRequest(
              `/subjects/${encodeURIComponent(subject)}/versions`
            );

            // Infer schema type from schema content (AVRO schemas are JSON objects)
            let schemaType: "AVRO" | "JSON" | "PROTOBUF" = "AVRO";
            try {
              const parsed = JSON.parse(latestVersion.schema);
              if (parsed.type === "record" || parsed.type === "enum" || parsed.type === "fixed") {
                schemaType = "AVRO";
              } else if (parsed.$schema) {
                schemaType = "JSON";
              }
            } catch {
              // If it's not valid JSON, might be Protobuf
              schemaType = "PROTOBUF";
            }

            // Get compatibility configuration
            let compatibility = "BACKWARD";
            try {
              const config: { compatibilityLevel: string } =
                await this.makeRequest(
                  `/config/${encodeURIComponent(subject)}`
                );
              compatibility = config.compatibilityLevel;
            } catch {
              // Try global config if subject-level config doesn't exist
              try {
                const globalConfig: { compatibilityLevel: string } =
                  await this.makeRequest(`/config`);
                compatibility = globalConfig.compatibilityLevel;
              } catch {
                // Use default BACKWARD if no config found
                compatibility = "BACKWARD";
              }
            }

            return {
              subject,
              latestVersion: latestVersion.version,
              schemaType: schemaType,
              compatibility: compatibility as SchemaSubject["compatibility"],
              versions,
            };
          } catch (error) {
            console.warn(
              `Failed to get details for subject ${subject}:`,
              error
            );
            return null;
          }
        })
      );

      // Filter out failed requests and apply filters
      let filteredSubjects = subjectDetails.filter(
        (s): s is SchemaSubject => s !== null
      );

      if (filters) {
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filteredSubjects = filteredSubjects.filter((s) =>
            s.subject.toLowerCase().includes(searchLower)
          );
        }

        if (filters.schemaType) {
          filteredSubjects = filteredSubjects.filter(
            (s) => s.schemaType === filters.schemaType
          );
        }

        if (filters.topic) {
          // Filter by associated topic (subjects often follow pattern: {topic}-{key|value})
          const topicLower = filters.topic.toLowerCase();
          filteredSubjects = filteredSubjects.filter((s) =>
            s.subject.toLowerCase().includes(topicLower)
          );
        }
      }

      return filteredSubjects;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to list schema subjects",
        cause: error,
      });
    }
  }

  async getSubjectVersions(subject: string): Promise<SchemaVersion[]> {
    try {
      const versions: number[] = await this.makeRequest(
        `/subjects/${encodeURIComponent(subject)}/versions`
      );

      const versionDetails = await Promise.all(
        versions.map(async (version) => {
          const versionData: SchemaVersion = await this.makeRequest(
            `/subjects/${encodeURIComponent(subject)}/versions/${version}`
          );
          return versionData;
        })
      );

      return versionDetails.sort((a, b) => b.version - a.version);
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to get versions for subject: ${subject}`,
        cause: error,
      });
    }
  }

  async getSchemaVersion(
    subject: string,
    version: number | "latest"
  ): Promise<SchemaVersion> {
    try {
      return await this.makeRequest(
        `/subjects/${encodeURIComponent(subject)}/versions/${version}`
      );
    } catch (error) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Schema not found: ${subject} version ${version}`,
        cause: error,
      });
    }
  }

  async registerSchema(
    subject: string,
    schemaData: RegisterSchemaRequest
  ): Promise<RegisterSchemaResponse> {
    try {
      return await this.makeRequest(
        `/subjects/${encodeURIComponent(subject)}/versions`,
        {
          method: "POST",
          body: JSON.stringify(schemaData),
        }
      );
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Failed to register schema for subject: ${subject}`,
        cause: error,
      });
    }
  }

  async checkCompatibility(
    subject: string,
    version: number | "latest",
    schema: string
  ): Promise<CompatibilityCheckResponse> {
    try {
      return await this.makeRequest(
        `/compatibility/subjects/${encodeURIComponent(
          subject
        )}/versions/${version}`,
        {
          method: "POST",
          body: JSON.stringify({ schema }),
        }
      );
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Failed to check schema compatibility",
        cause: error,
      });
    }
  }

  async updateCompatibility(
    subject: string,
    compatibility: SchemaSubject["compatibility"]
  ): Promise<{ compatibility: string }> {
    try {
      return await this.makeRequest(`/config/${encodeURIComponent(subject)}`, {
        method: "PUT",
        body: JSON.stringify({ compatibility }),
      });
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Failed to update compatibility for subject: ${subject}`,
        cause: error,
      });
    }
  }

  async deleteSubject(
    subject: string,
    permanent: boolean = false
  ): Promise<number[]> {
    try {
      const endpoint = permanent
        ? `/subjects/${encodeURIComponent(subject)}?permanent=true`
        : `/subjects/${encodeURIComponent(subject)}`;

      return await this.makeRequest(endpoint, {
        method: "DELETE",
      });
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Failed to delete subject: ${subject}`,
        cause: error,
      });
    }
  }

  async validateSchema(
    schema: string,
    schemaType: "AVRO" | "JSON" | "PROTOBUF"
  ): Promise<boolean> {
    try {
      // For AVRO schemas, try to parse as JSON first
      if (schemaType === "AVRO") {
        JSON.parse(schema);
      }

      // Additional validation could be added here for specific schema types
      return true;
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid schema format",
        cause: error,
      });
    }
  }
}

// Singleton instance
let schemaRegistryService: SchemaRegistryService | null = null;

export function getSchemaRegistryService(): SchemaRegistryService {
  if (!schemaRegistryService) {
    const config: SchemaRegistryConfig = {
      url: process.env.SCHEMA_REGISTRY_URL || "http://schema-registry:8081",
    };

    // Add authentication if configured
    if (
      process.env.SCHEMA_REGISTRY_USERNAME &&
      process.env.SCHEMA_REGISTRY_PASSWORD
    ) {
      config.auth = {
        username: process.env.SCHEMA_REGISTRY_USERNAME,
        password: process.env.SCHEMA_REGISTRY_PASSWORD,
      };
    }

    schemaRegistryService = new SchemaRegistryService(config);
  }
  return schemaRegistryService;
}
