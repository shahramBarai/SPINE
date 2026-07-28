import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

// Turns a plain Error thrown by ProjectFileService's validation (e.g. a
// disallowed file extension) into a client-facing 400, instead of letting
// it fall through as an opaque 500.
function asBadRequest(error: unknown, fallbackMessage: string): TRPCError {
    return new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : fallbackMessage
    });
}

// ProjectFileService no longer mints an id for a new file - it just writes
// whatever last path segment it's given. Callers that create a new file
// (as opposed to referencing an existing one) generate that segment here,
// keeping the extension so assertAllowedExtension/getMimeType still work,
// while the real name the user picked is preserved only in File.fileName.
function generateFileId(fileName: string): string {
    const extension = fileName.split(".").pop();
    return extension ? `${randomUUID()}.${extension}` : randomUUID();
}

export { asBadRequest, generateFileId };
