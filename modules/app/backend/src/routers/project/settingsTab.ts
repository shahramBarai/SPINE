import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import {
    projectViewerProcedure,
    projectOwnerProcedure
} from "../../procedures/project";
import {
    EntityService,
    UserService,
    ApiKeyService
} from "@spine/storage-platform";
import { type MemberRole } from "@spine/storage-platform/types";
import { ProjectFileService } from "@spine/storage-minio";
import { getCoverImageUrl } from "../../utils/coverImage";
import { asBadRequest } from "./shared";

const API_KEY_NAME_MAX_LENGTH = 100;

/**
 * Rejects an expiry that is already in the past, which would otherwise mint
 * or leave a key that can never authenticate.
 */
function assertFutureExpiry(expiresAt: Date | null | undefined): void {
    if (expiresAt && expiresAt <= new Date()) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Expiry must be in the future."
        });
    }
}

// Backs SettingsTab's four sections (ProjectDetailsSection, MembersSection,
// CoverImageSection, ApiKeysSection) - each too small for its own file, but
// together they're exactly the tab's scope.
export const settingsTabRouter = router({
    getMyRole: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }): Promise<MemberRole | null> => {
            const member = await EntityService.getMember(
                input.projectId,
                ctx.user.id
            );
            return member?.role ?? null;
        }),

    // Basic project info for the manage page - kept separate from
    // digitalTwin.getProject, which is gated on the project being
    // twin-enabled.
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

    updateSettings: projectOwnerProcedure
        .input(
            z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                isTwinEnabled: z.boolean()
            })
        )
        .mutation(async ({ input }) => {
            return await EntityService.updateEntity(input.projectId, {
                name: input.name,
                description: input.description,
                isTwinEnabled: input.isTwinEnabled
            });
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

    removeCoverImage: projectOwnerProcedure.mutation(async ({ input }) => {
        const project = await EntityService.getEntityById(input.projectId);
        if (project?.coverImageKey) {
            await ProjectFileService.deleteFile(project.coverImageKey);
        }

        await EntityService.updateEntity(input.projectId, {
            coverImageKey: null
        });
        return { success: true };
    }),

    // API keys authenticate external systems that have no user session.
    // Owner-only: a key's scope is granted per graph and per file, so
    // handing one out is a standing grant over whatever it's been given.
    listApiKeys: projectOwnerProcedure.query(async ({ input }) => {
        return await ApiKeyService.listApiKeys(input.projectId);
    }),

    createApiKey: projectOwnerProcedure
        .input(
            z.object({
                name: z.string().trim().min(1).max(API_KEY_NAME_MAX_LENGTH),
                canReadGraph: z.boolean().default(false),
                expiresAt: z.coerce.date().nullish()
            })
        )
        .mutation(async ({ input }) => {
            assertFutureExpiry(input.expiresAt);

            return await ApiKeyService.createApiKey(
                input.projectId,
                input.name,
                {
                    canReadGraph: input.canReadGraph,
                    expiresAt: input.expiresAt ?? null
                }
            );
        }),

    updateApiKeyAccess: projectOwnerProcedure
        .input(
            z.object({
                keyId: z.string(),
                canReadGraph: z.boolean().optional(),
                expiresAt: z.coerce.date().nullish()
            })
        )
        .mutation(async ({ input }) => {
            assertFutureExpiry(input.expiresAt);

            try {
                await ApiKeyService.updateApiKeyAccess(
                    input.projectId,
                    input.keyId,
                    {
                        canReadGraph: input.canReadGraph,
                        expiresAt: input.expiresAt
                    }
                );
            } catch {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "API key not found"
                });
            }

            return { success: true };
        }),

    listApiKeyFiles: projectOwnerProcedure
        .input(z.object({ keyId: z.string() }))
        .query(async ({ input }) => {
            return await ApiKeyService.listFileGrants(
                input.projectId,
                input.keyId
            );
        }),

    // Saves the key's granted files as a single desired state, mirroring
    // updateMembers: only the difference against what's already granted is
    // written, so re-saving an unchanged selection costs nothing.
    setApiKeyFiles: projectOwnerProcedure
        .input(z.object({ keyId: z.string(), fileIds: z.array(z.string()) }))
        .mutation(async ({ input }) => {
            const current = await ApiKeyService.listFileGrants(
                input.projectId,
                input.keyId
            );
            const currentIds = new Set(current.map((file) => file.id));
            const nextIds = new Set(input.fileIds);

            const toAdd = input.fileIds.filter((id) => !currentIds.has(id));
            const toRemove = current.filter((file) => !nextIds.has(file.id));

            try {
                for (const fileId of toAdd) {
                    await ApiKeyService.addFileGrant(
                        input.projectId,
                        input.keyId,
                        fileId
                    );
                }
            } catch (error) {
                throw asBadRequest(error, "Failed to grant file access");
            }

            await Promise.all(
                toRemove.map((file) =>
                    ApiKeyService.removeFileGrant(
                        input.projectId,
                        input.keyId,
                        file.id
                    )
                )
            );

            return { granted: input.fileIds.length };
        }),

    revokeApiKey: projectOwnerProcedure
        .input(z.object({ keyId: z.string() }))
        .mutation(async ({ input }) => {
            await ApiKeyService.revokeApiKey(input.projectId, input.keyId);
            return { success: true };
        })
});
