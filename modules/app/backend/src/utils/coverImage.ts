import { env } from "@spine/shared";

// Cover images are served through the /files proxy (see routes/projectFiles.ts)
// rather than a presigned MinIO URL, so viewing one always re-checks the
// project's current visibility/membership instead of handing out a bearer
// link that keeps working after access is revoked.
function getCoverImageUrl(
    coverImageKey: string | null | undefined
): string | null {
    if (!coverImageKey) {
        return null;
    }

    return `${env.BACKEND_URL}/files/${coverImageKey}`;
}

export { getCoverImageUrl };
