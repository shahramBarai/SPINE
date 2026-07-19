import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
    projectViewerProcedure,
    projectEditorProcedure,
    projectOwnerProcedure
} from "../procedures/project";
import { EntityService, UserService } from "@spine/storage-platform";
import { type MemberRole } from "@spine/storage-platform/types";
import { ProjectFileService } from "@spine/storage-minio";
import { DatasetService } from "@spine/storage-rdf-store";
import { readStreamToText } from "../utils/stream";
import { getCoverImageUrl } from "../utils/coverImage";

// Turns a plain Error thrown by ProjectFileService's validation (e.g. a
// disallowed file extension) into a client-facing 400, instead of letting
// it fall through as an opaque 500.
function asBadRequest(error: unknown, fallbackMessage: string): TRPCError {
    return new TRPCError({
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : fallbackMessage
    });
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
            const project = await EntityService.getEntityById(
                input.projectId
            );
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
            await ProjectFileService.createProjectFolder(
                input.projectId,
                input.folder
            );
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

    listGraphs: projectEditorProcedure.query(async ({ input }) => {
        return await DatasetService.read_list_graphs(input.projectId);
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
        })
});
