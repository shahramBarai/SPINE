import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EntityService } from "@spine/storage-platform";
import { type MemberRole } from "@spine/storage-platform/types";
import { protectedProcedure, publicProcedure } from "../trpc";

const projectMemberProcedure = protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .use(async ({ ctx, input, next }) => {
        const member = await EntityService.getMember(
            input.projectId,
            ctx.user.id
        );
        if (!member) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You are not a member of this project"
            });
        }

        return next({ ctx: { ...ctx, projectRole: member.role } });
    });

function requireRole(allowedRoles: MemberRole[]) {
    return projectMemberProcedure.use(async ({ ctx, next }) => {
        if (!allowedRoles.includes(ctx.projectRole)) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: `Requires one of the following roles: ${allowedRoles.join(", ")}`
            });
        }

        return next({ ctx });
    });
}

// Any project member (OWNER, EDITOR, or VIEWER).
const projectViewerProcedure = projectMemberProcedure;

// OWNER or EDITOR only.
const projectEditorProcedure = requireRole(["OWNER", "EDITOR"]);

// OWNER only.
const projectOwnerProcedure = requireRole(["OWNER"]);

/**
 * Read access to a project's digital twin. Unlike the tiers above this
 * builds on publicProcedure, not protectedProcedure: a twin-enabled project
 * is viewable by anyone including anonymous visitors, while a draft one
 * stays previewable by its own members so they can check it before
 * launching. Resolves the project once and passes it down as `ctx.project`.
 *
 * A draft project rejects with NOT_FOUND rather than FORBIDDEN so its
 * existence isn't leaked to callers who can't see it.
 */
const twinProjectProcedure = publicProcedure
    .input(z.object({ projectId: z.string() }))
    .use(async ({ ctx, input, next }) => {
        const project = await EntityService.getEntityById(input.projectId);
        const notFound = new TRPCError({
            code: "NOT_FOUND",
            message: `Project not found: ${input.projectId}`
        });
        if (!project) {
            throw notFound;
        }

        if (!project.isTwinEnabled) {
            const userId = ctx.session.data?.user?.id;
            const member = userId
                ? await EntityService.getMember(input.projectId, userId)
                : null;
            if (!member) {
                throw notFound;
            }
        }

        return next({ ctx: { ...ctx, project } });
    });

export {
    projectViewerProcedure,
    projectEditorProcedure,
    projectOwnerProcedure,
    twinProjectProcedure
};
