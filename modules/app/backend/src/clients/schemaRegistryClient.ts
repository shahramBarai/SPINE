import { env } from "@spine/shared";

// Thin client for a Confluent Schema Registry instance, backing the
// /admin/schemas pages. The registry's REST API is the contract here - this
// file deliberately mirrors its endpoints rather than inventing an
// abstraction over them.

type SchemaType = "AVRO" | "JSON" | "PROTOBUF";

type CompatibilityLevel =
    | "NONE"
    | "BACKWARD"
    | "FORWARD"
    | "FULL"
    | "BACKWARD_TRANSITIVE"
    | "FORWARD_TRANSITIVE"
    | "FULL_TRANSITIVE";

interface SchemaSubject {
    subject: string;
    latestVersion: number;
    schemaType: SchemaType;
    compatibility: CompatibilityLevel;
    versions: number[];
}

interface SchemaVersion {
    id: number;
    version: number;
    schema: string;
    subject: string;
    schemaType: SchemaType;
    references?: unknown[];
}

interface SchemaFilters {
    search?: string;
    schemaType?: SchemaType;
    topic?: string;
}

interface RegisterSchemaRequest {
    schema: string;
    schemaType?: SchemaType;
    references?: unknown[];
}

interface CompatibilityCheckResponse {
    is_compatible: boolean;
    messages?: string[];
}

class SchemaRegistryError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "SchemaRegistryError";
        this.status = status;
    }
}

const CONTENT_TYPE = "application/vnd.schemaregistry.v1+json";

function authHeader(): Record<string, string> {
    const { SCHEMA_REGISTRY_USERNAME, SCHEMA_REGISTRY_PASSWORD } = env;
    if (!SCHEMA_REGISTRY_USERNAME || !SCHEMA_REGISTRY_PASSWORD) {
        return {};
    }

    const encoded = Buffer.from(
        `${SCHEMA_REGISTRY_USERNAME}:${SCHEMA_REGISTRY_PASSWORD}`
    ).toString("base64");

    return { Authorization: `Basic ${encoded}` };
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${env.SCHEMA_REGISTRY_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": CONTENT_TYPE,
            ...authHeader(),
            ...((options.headers as Record<string, string>) ?? {})
        }
    });

    if (!response.ok) {
        const body = await response
            .json()
            .catch(() => ({ message: "Unknown error" }));

        throw new SchemaRegistryError(
            body.message || `Schema Registry error: ${response.status}`,
            response.status
        );
    }

    return await response.json();
}

/** AVRO and JSON schemas are JSON documents; anything unparseable is assumed Protobuf. */
function inferSchemaType(schema: string): SchemaType {
    try {
        const parsed = JSON.parse(schema);

        if (["record", "enum", "fixed"].includes(parsed.type)) {
            return "AVRO";
        }

        return parsed.$schema ? "JSON" : "AVRO";
    } catch {
        return "PROTOBUF";
    }
}

/** Subject-level compatibility, falling back to the global setting, then BACKWARD. */
async function getCompatibility(subject: string): Promise<CompatibilityLevel> {
    for (const endpoint of [
        `/config/${encodeURIComponent(subject)}`,
        "/config"
    ]) {
        try {
            const config = await request<{
                compatibilityLevel: CompatibilityLevel;
            }>(endpoint);
            return config.compatibilityLevel;
        } catch {
            continue;
        }
    }

    return "BACKWARD";
}

function matchesFilters(
    subject: SchemaSubject,
    filters: SchemaFilters
): boolean {
    if (
        filters.search &&
        !subject.subject.toLowerCase().includes(filters.search.toLowerCase())
    ) {
        return false;
    }

    if (filters.schemaType && subject.schemaType !== filters.schemaType) {
        return false;
    }

    // Subjects conventionally follow a {topic}-{key|value} naming pattern, so
    // a topic filter is a substring match on the subject name.
    if (
        filters.topic &&
        !subject.subject.toLowerCase().includes(filters.topic.toLowerCase())
    ) {
        return false;
    }

    return true;
}

/**
 * Every subject with its latest version, type and compatibility level. The
 * registry has no bulk endpoint for this, so it costs a handful of requests
 * per subject; a subject whose details fail to load is dropped rather than
 * failing the whole listing.
 */
async function listSubjects(filters?: SchemaFilters): Promise<SchemaSubject[]> {
    const subjects = await request<string[]>("/subjects");

    const details = await Promise.all(
        subjects.map(async (subject): Promise<SchemaSubject | null> => {
            try {
                const encoded = encodeURIComponent(subject);

                const [latest, versions] = await Promise.all([
                    request<SchemaVersion>(
                        `/subjects/${encoded}/versions/latest`
                    ),
                    request<number[]>(`/subjects/${encoded}/versions`)
                ]);

                return {
                    subject,
                    latestVersion: latest.version,
                    schemaType: inferSchemaType(latest.schema),
                    compatibility: await getCompatibility(subject),
                    versions
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

    const found = details.filter((s): s is SchemaSubject => s !== null);

    return filters ? found.filter((s) => matchesFilters(s, filters)) : found;
}

/** Every version of a subject, newest first. */
async function getSubjectVersions(subject: string): Promise<SchemaVersion[]> {
    const encoded = encodeURIComponent(subject);
    const versions = await request<number[]>(`/subjects/${encoded}/versions`);

    const details = await Promise.all(
        versions.map((version) =>
            request<SchemaVersion>(`/subjects/${encoded}/versions/${version}`)
        )
    );

    return details.sort((a, b) => b.version - a.version);
}

async function getSchemaVersion(
    subject: string,
    version: number | "latest"
): Promise<SchemaVersion> {
    return await request<SchemaVersion>(
        `/subjects/${encodeURIComponent(subject)}/versions/${version}`
    );
}

async function registerSchema(
    subject: string,
    schemaData: RegisterSchemaRequest
): Promise<{ id: number }> {
    return await request(`/subjects/${encodeURIComponent(subject)}/versions`, {
        method: "POST",
        body: JSON.stringify(schemaData)
    });
}

async function checkCompatibility(
    subject: string,
    version: number | "latest",
    schema: string
): Promise<CompatibilityCheckResponse> {
    return await request(
        `/compatibility/subjects/${encodeURIComponent(subject)}/versions/${version}`,
        {
            method: "POST",
            body: JSON.stringify({ schema })
        }
    );
}

async function updateCompatibility(
    subject: string,
    compatibility: CompatibilityLevel
): Promise<{ compatibility: string }> {
    return await request(`/config/${encodeURIComponent(subject)}`, {
        method: "PUT",
        body: JSON.stringify({ compatibility })
    });
}

/** Soft-deletes a subject, or removes it irrecoverably when `permanent`. */
async function deleteSubject(
    subject: string,
    permanent = false
): Promise<number[]> {
    const encoded = encodeURIComponent(subject);

    return await request(
        permanent
            ? `/subjects/${encoded}?permanent=true`
            : `/subjects/${encoded}`,
        { method: "DELETE" }
    );
}

export {
    SchemaRegistryError,
    listSubjects,
    getSubjectVersions,
    getSchemaVersion,
    registerSchema,
    checkCompatibility,
    updateCompatibility,
    deleteSubject,
    type SchemaType,
    type CompatibilityLevel,
    type SchemaSubject,
    type SchemaVersion,
    type SchemaFilters,
    type CompatibilityCheckResponse
};
