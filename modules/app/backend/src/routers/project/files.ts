import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../../trpc";
import { projectEditorProcedure } from "../../procedures/project";
import { FileService } from "@spine/storage-platform";
import { ProjectFileService } from "@spine/storage-minio";
import { getMimeType } from "../../utils/secureFile";
import { asBadRequest, generateFileId } from "./shared";

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

// Backs FilesOverviewTab/FileStorageSection.
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

    getUploadUrl: projectEditorProcedure
        .input(z.object({ folder: z.string().min(1), fileName: z.string() }))
        .mutation(async ({ input }) => {
            const fileId = generateFileId(input.fileName);
            try {
                const { uploadUrl, objectKey } =
                    await ProjectFileService.createUploadUrl(
                        input.projectId,
                        fileId,
                        ProjectFileService.ALLOWED_EXTENSIONS.file,
                        input.folder
                    );
                return { uploadUrl, objectKey, fileId };
            } catch (error) {
                throw asBadRequest(error, "Invalid file");
            }
        }),

    // Registers a file after its presigned upload completed - the frontend
    // still PUTs bytes straight to MinIO, then calls this so the database
    // (the authoritative source of what files exist) finds out. Verifies
    // the object actually landed in MinIO first, so a browser tab closed
    // mid-upload can't create a row for bytes that were never written.
    confirmUpload: projectEditorProcedure
        .input(
            z.object({
                folder: z.string().min(1),
                fileId: z.string(),
                fileName: z.string()
            })
        )
        .mutation(async ({ ctx, input }) => {
            const objectKey = ProjectFileService.buildObjectKey(
                input.projectId,
                input.fileId,
                input.folder
            );
            const stat = await ProjectFileService.statFile(objectKey);
            if (!stat) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message:
                        "Upload did not complete - the file wasn't found in storage."
                });
            }

            return await FileService.createFile({
                id: input.fileId,
                entityId: input.projectId,
                fileName: input.fileName,
                size: stat.size,
                mimeType: getMimeType(input.fileName),
                objectKey,
                createdBy: ctx.user.id
            });
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
