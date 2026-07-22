import { env } from "@spine/shared";

// Thin client for modules/modeling/building-service's FastAPI pipeline
// router (src/routers/pipeline.py) - deliberately specific to that one
// service's actual endpoints rather than a generic "any tool" client. See
// the Tools section design discussion: we're hardcoding this integration
// until a second real tool service exists to learn a real contract from.

class BuildingServiceError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "BuildingServiceError";
        this.status = status;
    }
}

interface UploadResult {
    filename: string;
    size_bytes: number;
}

type ConversionJobStatus = "queued" | "running" | "completed" | "failed";

interface ConversionJob {
    job_id: string;
    details: {
        source_file: string;
        target_ttl: string;
        IfcToLbdOptions: { level: number; ifcOWL: boolean };
    };
    status_info: {
        status: ConversionJobStatus;
        error: string | null;
        updated_at: string;
    };
    created_at: string;
}

async function raiseForStatus(response: Response): Promise<void> {
    if (response.ok) {
        return;
    }

    const body = await response.text().catch(() => "");
    throw new BuildingServiceError(
        `Building service request failed with status ${response.status}${body ? `: ${body}` : ""}`,
        response.status
    );
}

/** Uploads a file into building-service's own temp storage, ahead of a conversion. */
async function uploadFile(
    fileName: string,
    content: Buffer
): Promise<UploadResult> {
    const arrayBuffer = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
    ) as ArrayBuffer;

    const form = new FormData();
    form.set("file", new Blob([arrayBuffer]), fileName);

    const response = await fetch(
        `${env.BUILDING_SERVICE_URL}/api/pipeline/upload`,
        { method: "POST", body: form }
    );
    await raiseForStatus(response);

    return await response.json();
}

/** Starts an IFC->TTL conversion job for an already-uploaded file, returning its job id. */
async function convertIfcToTtl(fileName: string): Promise<string> {
    const url = new URL(
        `${env.BUILDING_SERVICE_URL}/api/pipeline/convert/ifc-to-ttl`
    );
    url.searchParams.set("filename", fileName);

    const response = await fetch(url, { method: "POST" });
    await raiseForStatus(response);

    return await response.json();
}

/** Fetches the current status of a conversion job. */
async function getConversionJob(jobId: string): Promise<ConversionJob> {
    const url = new URL(`${env.BUILDING_SERVICE_URL}/api/pipeline/convert/job`);
    url.searchParams.set("job_id", jobId);

    const response = await fetch(url);
    if (response.status === 404) {
        throw new BuildingServiceError(
            `Conversion job not found: ${jobId}`,
            404
        );
    }
    await raiseForStatus(response);

    return await response.json();
}

/** Downloads a file (typically a completed job's output) from building-service. */
async function downloadFile(fileName: string): Promise<Buffer> {
    const url = new URL(`${env.BUILDING_SERVICE_URL}/api/pipeline/download`);
    url.searchParams.set("filename", fileName);

    const response = await fetch(url);
    await raiseForStatus(response);

    return Buffer.from(await response.arrayBuffer());
}

export {
    BuildingServiceError,
    uploadFile,
    convertIfcToTtl,
    getConversionJob,
    downloadFile,
    type ConversionJob,
    type ConversionJobStatus
};
