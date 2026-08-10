import { randomUUID } from "crypto";

// ProjectFileService doesn't mint an id for a new file - it just writes
// whatever last path segment it's given. Callers that create a new file
// (as opposed to referencing an existing one) generate that segment here,
// keeping the extension so assertAllowedExtension/getMimeType still work,
// while the real name the user picked is preserved only in File.fileName.
function generateFileId(fileName: string): string {
    const extension = fileName.split(".").pop();
    return extension ? `${randomUUID()}.${extension}` : randomUUID();
}

export { generateFileId };
