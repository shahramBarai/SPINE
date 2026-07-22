import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
    projectViewerProcedure,
    projectEditorProcedure,
    projectOwnerProcedure
} from "../procedures/project";
import {
    EntityService,
    UserService,
    JobExecutionService
} from "@spine/storage-platform";
import {
    type MemberRole,
    type JobExecutionStatus
} from "@spine/storage-platform/types";
import { ProjectFileService } from "@spine/storage-minio";
import { DatasetService } from "@spine/storage-rdf-store";
import { readStreamToBuffer, readStreamToText } from "../utils/stream";
import { getCoverImageUrl } from "../utils/coverImage";
import { TOOLS } from "../tools";
import { BuildingServiceClient } from "../clients";
import { basename } from "path";

// Turns a plain Error thrown by ProjectFileService's validation (e.g. a
// disallowed file extension) into a client-facing 400, instead of letting
// it fall through as an opaque 500.
function asBadRequest(error: unknown, fallbackMessage: string): TRPCError {
    return new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : fallbackMessage
    });
}

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

export const projectRouter = router({
    getMyRole: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }): Promise<MemberRole | null> => {
            const member = await EntityService.getMember(
                input.projectId,
                ctx.user.id
            );
            return member?.role ?? null;
        }),

    // Basic project info for the manage page - deliberately lighter than
    // digitalTwin.getProject, which also resolves a Fuseki rootId for the
    // 3D/graph viewer's default focus node. That resolution fails for a
    // project with no synced Fuseki data yet, which would needlessly break
    // the manage page (name/description/cover editing, etc.) even though it
    // never uses rootId.
    getProjectInfo: projectViewerProcedure.query(async ({ input }) => {
        const project = await EntityService.getEntityById(input.projectId);
        if (!project) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: `Project not found: ${input.projectId}`
            });
        }

        return {
            ...project,
            coverImageUrl: getCoverImageUrl(project.coverImageKey)
        };
    }),

    getMembers: projectViewerProcedure.query(async ({ input }) => {
        const members = await EntityService.getMembers(input.projectId);
        const userDetails = await Promise.all(
            members.map((member) => UserService.getUserById(member.userId))
        );

        return members.map((member, i) => ({
            userId: member.userId,
            role: member.role,
            name: userDetails[i]?.name ?? null,
            email: userDetails[i]?.email ?? ""
        }));
    }),

    // Saves the project's member table as a single desired state: adds
    // members missing from the current membership, removes members no
    // longer present, and updates roles that changed - all in one call
    // instead of one round-trip per edit.
    updateMembers: projectOwnerProcedure
        .input(
            z.object({
                members: z
                    .array(
                        z.object({
                            userId: z.string(),
                            role: z.enum(["OWNER", "EDITOR", "VIEWER"])
                        })
                    )
                    .min(1)
            })
        )
        .mutation(async ({ input }) => {
            if (!input.members.some((member) => member.role === "OWNER")) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "A project must have at least one owner"
                });
            }

            const current = await EntityService.getMembers(input.projectId);
            const nextUserIds = new Set(
                input.members.map((member) => member.userId)
            );

            const toAdd = input.members.filter(
                (member) => !current.some((c) => c.userId === member.userId)
            );
            const toRemove = current.filter(
                (member) => !nextUserIds.has(member.userId)
            );
            const toUpdateRole = input.members.filter((member) => {
                const existing = current.find(
                    (c) => c.userId === member.userId
                );
                return existing !== undefined && existing.role !== member.role;
            });

            if (toAdd.length > 0) {
                await EntityService.addMembers(input.projectId, toAdd);
            }
            await Promise.all([
                ...toRemove.map((member) =>
                    EntityService.removeMember(input.projectId, member.userId)
                ),
                ...toUpdateRole.map((member) =>
                    EntityService.updateMemberRole(
                        input.projectId,
                        member.userId,
                        member.role
                    )
                )
            ]);

            return await EntityService.getMembers(input.projectId);
        }),

    updateSettings: projectOwnerProcedure
        .input(
            z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                isPublic: z.boolean()
            })
        )
        .mutation(async ({ input }) => {
            return await EntityService.updateEntity(input.projectId, {
                name: input.name,
                description: input.description,
                isPublic: input.isPublic
            });
        }),

    getCoverUploadUrl: projectOwnerProcedure
        .input(z.object({ fileName: z.string() }))
        .mutation(async ({ input }) => {
            try {
                return await ProjectFileService.getCoverImageUploadUrl(
                    input.projectId,
                    input.fileName
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid cover image");
            }
        }),

    // Points the project at a newly-uploaded cover image and cleans up the
    // previous one, so replacing a cover doesn't leave orphaned files behind.
    setCoverImage: projectOwnerProcedure
        .input(z.object({ objectKey: z.string() }))
        .mutation(async ({ input }) => {
            const project = await EntityService.getEntityById(input.projectId);
            const previousKey = project?.coverImageKey;

            await EntityService.updateEntity(input.projectId, {
                coverImageKey: input.objectKey
            });

            if (previousKey && previousKey !== input.objectKey) {
                await ProjectFileService.deleteCoverImage(previousKey);
            }

            return { coverImageUrl: getCoverImageUrl(input.objectKey) };
        }),

    removeCoverImage: projectOwnerProcedure.mutation(async ({ input }) => {
        const project = await EntityService.getEntityById(input.projectId);
        if (project?.coverImageKey) {
            await ProjectFileService.deleteCoverImage(project.coverImageKey);
        }

        await EntityService.updateEntity(input.projectId, {
            coverImageKey: null
        });
        return { success: true };
    }),

    listFiles: projectEditorProcedure.query(async ({ input }) => {
        return await ProjectFileService.listProjectFiles(input.projectId);
    }),

    createFolder: projectEditorProcedure
        .input(z.object({ folder: z.string().min(1) }))
        .mutation(async ({ input }) => {
            try {
                await ProjectFileService.createProjectFolder(
                    input.projectId,
                    input.folder
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid folder name");
            }
            return { folder: input.folder };
        }),

    getUploadUrl: projectEditorProcedure
        .input(z.object({ folder: z.string().min(1), fileName: z.string() }))
        .mutation(async ({ input }) => {
            try {
                return await ProjectFileService.getProjectFileUploadUrl(
                    input.projectId,
                    input.folder,
                    input.fileName
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid file");
            }
        }),

    deleteFile: projectEditorProcedure
        .input(
            z.object({
                folder: z.string(),
                fileId: z.string(),
                fileName: z.string()
            })
        )
        .mutation(async ({ input }) => {
            await ProjectFileService.deleteProjectFile(
                input.projectId,
                input.folder,
                input.fileId,
                input.fileName
            );
            return { success: true };
        }),

    deleteFolder: projectEditorProcedure
        .input(z.object({ folder: z.string().min(1) }))
        .mutation(async ({ input }) => {
            await ProjectFileService.deleteProjectFolder(
                input.projectId,
                input.folder
            );
            return { success: true };
        }),

    listGraphs: projectEditorProcedure.query(async ({ input }) => {
        return await DatasetService.read_list_graphs(input.projectId);
    }),

    createGraph: projectEditorProcedure
        .input(z.object({ graphUri: z.string().min(1) }))
        .mutation(async ({ input }) => {
            if (input.graphUri === "default") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default graph always exists"
                });
            }

            try {
                await DatasetService.createGraph(
                    input.projectId,
                    input.graphUri
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid graph URI");
            }

            return { graphUri: input.graphUri };
        }),

    renameGraph: projectEditorProcedure
        .input(
            z.object({
                oldUri: z.string().min(1),
                newUri: z.string().min(1)
            })
        )
        .mutation(async ({ input }) => {
            if (input.oldUri === "default" || input.newUri === "default") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default graph cannot be renamed"
                });
            }

            try {
                await DatasetService.renameGraph(
                    input.projectId,
                    input.oldUri,
                    input.newUri
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid graph URI");
            }

            return { graphUri: input.newUri };
        }),

    deleteGraph: projectEditorProcedure
        .input(z.object({ graphUri: z.string().min(1) }))
        .mutation(async ({ input }) => {
            if (input.graphUri === "default") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default graph cannot be deleted"
                });
            }

            await DatasetService.deleteGraph(input.projectId, input.graphUri);
            return { success: true };
        }),

    loadTtlToFuseki: projectEditorProcedure
        .input(
            z.object({
                folder: z.string(),
                fileId: z.string(),
                fileName: z.string(),
                graphUri: z.string().min(1),
                replace: z.boolean().default(false)
            })
        )
        .mutation(async ({ input }) => {
            const fileStream = await ProjectFileService.readProjectFile(
                input.projectId,
                input.folder,
                input.fileId,
                input.fileName
            );
            if (!fileStream) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `File not found: ${input.fileName}`
                });
            }

            const ttlContent = await readStreamToText(fileStream);
            await DatasetService.uploadTtlToFuseki(
                input.projectId,
                Buffer.from(ttlContent, "utf-8"),
                input.graphUri,
                input.replace
            );

            return { graphUri: input.graphUri };
        }),

    // Hardcoded tool catalog - see the Tools section design discussion.
    // Not project-scoped: it's a static list, not project data.
    listTools: protectedProcedure.query(() => TOOLS),

    // A project's history of executed jobs (tool runs today, Flink pipeline
    // runs later) - see the JobExecution design discussion.
    listJobExecutions: projectEditorProcedure.query(async ({ input }) => {
        return await JobExecutionService.listJobExecutions(input.projectId);
    }),

    runIfcToTtlTool: projectEditorProcedure
        .input(
            z.object({
                folder: z.string(),
                fileId: z.string(),
                fileName: z.string()
            })
        )
        .mutation(async ({ ctx, input }) => {
            if (!input.fileName.toLowerCase().endsWith(".ifc")) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Only .ifc files can be converted to TTL."
                });
            }

            const fileStream = await ProjectFileService.readProjectFile(
                input.projectId,
                input.folder,
                input.fileId,
                input.fileName
            );
            if (!fileStream) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `File not found: ${input.fileName}`
                });
            }

            try {
                const content = await readStreamToBuffer(fileStream);
                // Prefix with our own fileId so re-running the tool on a
                // different file that happens to share a name doesn't
                // collide with an existing building-service job.
                const uploadName = `${input.fileId}_${input.fileName}`;
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
                            folder: input.folder,
                            fileId: input.fileId,
                            fileName: input.fileName
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
        .mutation(async ({ input }) => {
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

            const saved = await ProjectFileService.saveProjectFileBuffer(
                input.projectId,
                input.folder,
                resultFileName,
                content
            );

            await JobExecutionService.updateJobExecution(jobExecution.id, {
                status: "COMPLETED",
                result: { folder: input.folder, ...saved }
            });

            return saved;
        })
});
