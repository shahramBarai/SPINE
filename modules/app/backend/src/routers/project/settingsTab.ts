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

    // API keys let external systems run read-only SPARQL queries against
    // this project's dataset (see routes/sparqlApi.ts) without a user
    // session - owner-only since creating one hands out standing query
    // access to the whole dataset.
    listApiKeys: projectOwnerProcedure.query(async ({ input }) => {
        return await ApiKeyService.listApiKeys(input.projectId);
    }),

    createApiKey: projectOwnerProcedure
        .input(z.object({ name: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            return await ApiKeyService.createApiKey(
                input.projectId,
                ctx.user.id,
                input.name.trim()
            );
        }),

    revokeApiKey: projectOwnerProcedure
        .input(z.object({ keyId: z.string() }))
        .mutation(async ({ input }) => {
            await ApiKeyService.revokeApiKey(input.projectId, input.keyId);
            return { success: true };
        })
});
