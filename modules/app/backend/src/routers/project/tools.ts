import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import { projectEditorProcedure } from "../../procedures/project";
import { FileService, JobExecutionService } from "@spine/storage-platform";
import { type JobExecutionStatus } from "@spine/storage-platform/types";
import { ProjectFileService } from "@spine/storage-minio";
import { readStreamToBuffer } from "../../utils/stream";
import { getMimeType } from "../../utils/secureFile";
import { generateFileId } from "../../utils/fileId";
import { TOOLS } from "../../tools";
import { BuildingServiceClient } from "../../clients";
import { basename } from "path";
import { asBadRequest } from "./shared";

function toJobExecutionStatus(
    status: BuildingServiceClient.ConversionJobStatus
): JobExecutionStatus {
    switch (status) {
        case "queued":
            return "QUEUED";
        case "running":
            return "RUNNING";
        case "completed":
            return "COMPLETED";
        case "failed":
            return "FAILED";
    }
}

// Looks up a job execution and checks it belongs to the given project, so
// one project's editors can't poll/save another project's job by guessing
// its executionId.
async function getOwnJobExecutionOrThrow(
    projectId: string,
    executionId: string
) {
    const jobExecution =
        await JobExecutionService.getJobExecutionById(executionId);
    if (!jobExecution || jobExecution.entityId !== projectId) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Job execution not found"
        });
    }
    return jobExecution;
}

// Backs FilesOverviewTab/ToolsSection, FilesOverviewTab/JobHistorySection
// (just listJobExecutions - too small for its own file, same feature area)
// and modals/RunIfcToTtlModal.
export const toolsRouter = router({
    // Hardcoded tool catalog - see the Tools section design discussion.
    // Not project-scoped: it's a static list, not project data.
    listTools: protectedProcedure.query(() => TOOLS),

    // A project's history of executed jobs (tool runs today, Flink pipeline
    // runs later) - see the JobExecution design discussion.
    listJobExecutions: projectEditorProcedure.query(async ({ input }) => {
        return await JobExecutionService.listJobExecutions(input.projectId);
    }),

    runIfcToTtlTool: projectEditorProcedure
        .input(z.object({ fileId: z.string() }))
        .mutation(async ({ ctx, input }) => {
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
            if (!file.fileName.toLowerCase().endsWith(".ifc")) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Only .ifc files can be converted to TTL."
                });
            }

            const fileStream = await ProjectFileService.readFile(
                file.objectKey
            );
            if (!fileStream) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `File not found: ${file.fileName}`
                });
            }

            try {
                const content = await readStreamToBuffer(fileStream);
                // Prefix with our own fileId so re-running the tool on a
                // different file that happens to share a name doesn't
                // collide with an existing building-service job.
                const uploadName = `${file.id}_${file.fileName}`;
                await BuildingServiceClient.uploadFile(uploadName, content);
                const jobId =
                    await BuildingServiceClient.convertIfcToTtl(uploadName);

                const jobExecution =
                    await JobExecutionService.createJobExecution({
                        entityId: input.projectId,
                        executedBy: ctx.user.id,
                        source: "TOOL",
                        jobKey: "ifc-to-ttl",
                        externalJobId: jobId,
                        input: {
                            folder: ProjectFileService.getFolderFromObjectKey(
                                file.objectKey
                            ),
                            fileId: file.id,
                            fileName: file.fileName
                        }
                    });
                return { executionId: jobExecution.id };
            } catch (error) {
                throw asBadRequest(error, "Failed to start conversion");
            }
        }),

    getToolJobStatus: projectEditorProcedure
        .input(z.object({ executionId: z.string() }))
        .query(async ({ input }) => {
            const jobExecution = await getOwnJobExecutionOrThrow(
                input.projectId,
                input.executionId
            );

            if (!jobExecution.externalJobId) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Job execution has no external job id."
                });
            }

            try {
                const job = await BuildingServiceClient.getConversionJob(
                    jobExecution.externalJobId
                );
                const status = toJobExecutionStatus(job.status_info.status);

                await JobExecutionService.updateJobExecution(jobExecution.id, {
                    status,
                    error: job.status_info.error
                });

                return {
                    executionId: jobExecution.id,
                    status,
                    error: job.status_info.error,
                    updatedAt: job.status_info.updated_at,
                    resultFileName: basename(job.details.target_ttl)
                };
            } catch (error) {
                if (
                    error instanceof BuildingServiceClient.BuildingServiceError
                ) {
                    throw new TRPCError({
                        code:
                            error.status === 404 ? "NOT_FOUND" : "BAD_GATEWAY",
                        message: error.message
                    });
                }
                throw error;
            }
        }),

    // Downloads a completed conversion job's result from building-service
    // and saves it as a new file in the project's own storage.
    saveToolResult: projectEditorProcedure
        .input(
            z.object({
                executionId: z.string(),
                folder: z.string().min(1)
            })
        )
        .mutation(async ({ ctx, input }) => {
            const jobExecution = await getOwnJobExecutionOrThrow(
                input.projectId,
                input.executionId
            );

            if (!jobExecution.externalJobId) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Job execution has no external job id."
                });
            }

            const job = await BuildingServiceClient.getConversionJob(
                jobExecution.externalJobId
            );
            if (job.status_info.status !== "completed") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Job is not complete yet (status: ${job.status_info.status}).`
                });
            }

            const resultFileName = basename(job.details.target_ttl);
            const content =
                await BuildingServiceClient.downloadFile(resultFileName);

            const fileId = generateFileId(resultFileName);
            const objectKey = await ProjectFileService.saveFile(
                input.projectId,
                fileId,
                content,
                ProjectFileService.ALLOWED_EXTENSIONS.file,
                input.folder
            );

            // This save is server-mediated (unlike the presigned-upload
            // path), so the database row is created right here rather than
            // through a separate confirmUpload call.
            await FileService.createFile({
                id: fileId,
                entityId: input.projectId,
                fileName: resultFileName,
                size: content.length,
                mimeType: getMimeType(resultFileName),
                objectKey,
                createdBy: ctx.user.id
            });

            await JobExecutionService.updateJobExecution(jobExecution.id, {
                status: "COMPLETED",
                result: { folder: input.folder, fileId, objectKey }
            });

            return { fileId, fileName: resultFileName };
        })
});
