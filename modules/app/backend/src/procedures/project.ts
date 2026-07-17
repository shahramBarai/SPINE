import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EntityService } from "@spine/storage-platform";
import { type MemberRole } from "@spine/storage-platform/types";
import { protectedProcedure } from "../trpc";

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

export {
    projectViewerProcedure,
    projectEditorProcedure,
    projectOwnerProcedure
};
