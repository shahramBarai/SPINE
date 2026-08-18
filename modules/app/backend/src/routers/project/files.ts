import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../../trpc";
import { projectEditorProcedure } from "../../procedures/project";
import { FileService } from "@spine/storage-platform";
import { ProjectFileService } from "@spine/storage-minio";

interface FileGroup {
    // undefined means the file lives at the project's root (no folder).
    folder: string | undefined;
    files: {
        fileId: string;
        fileName: string;
        size: number;
        objectKey: string;
        lastModified: Date;
    }[];
    totalSize: number;
    lastModified?: Date;
}

// Backs FilesOverviewTab/FileStorageSection. Uploads themselves go through
// the plain PUT /files/<projectId>/<folder> route (routes/projectFiles.ts),
// not a tRPC mutation - that's what lets the request body stream straight
// into MinIO instead of round-tripping through a presigned URL.
export const filesRouter = router({
    listFiles: projectEditorProcedure.query(async ({ input }) => {
        const files = await FileService.listFiles(input.projectId);
        const groups = new Map<string | undefined, FileGroup>();

        for (const file of files) {
            const folder = ProjectFileService.getFolderFromObjectKey(
                file.objectKey
            );

            let group = groups.get(folder);
            if (!group) {
                group = { folder, files: [], totalSize: 0 };
                groups.set(folder, group);
            }

            group.files.push({
                fileId: file.id,
                fileName: file.fileName,
                size: file.size,
                objectKey: file.objectKey,
                lastModified: file.updatedAt
            });
            group.totalSize += file.size;
            if (!group.lastModified || file.updatedAt > group.lastModified) {
                group.lastModified = file.updatedAt;
            }
        }

        return Array.from(groups.values());
    }),

    // Deletes the database row first (the authoritative record of what
    // exists), then best-effort cleans up the MinIO object - a failed
    // cleanup is logged, not surfaced as a request failure, since the
    // database is what every listing now reads from.
    deleteFile: projectEditorProcedure
        .input(z.object({ fileId: z.string() }))
        .mutation(async ({ input }) => {
            const file = await FileService.getFile(
                input.projectId,
                input.fileId
            );
            if (!file) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "File not found"
                });
            }

            await FileService.deleteFile(input.projectId, input.fileId);

            try {
                await ProjectFileService.deleteFile(file.objectKey);
            } catch (error) {
                console.error(
                    `Failed to delete MinIO object for file ${file.id} after removing its database row:`,
                    error
                );
            }

            return { success: true };
        })
});
