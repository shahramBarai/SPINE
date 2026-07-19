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
import {
    PresignedService,
    BucketService,
    type BUCKET_NAMES
} from "@spine/storage-minio";
import { DatasetService } from "@spine/storage-rdf-store";
import { readStreamToText } from "../utils/stream";
import {
    COVER_IMAGE_FOLDER,
    buildCoverObjectName,
    getCoverImageUrl
} from "../utils/coverImage";

const BUCKET_NAME: BUCKET_NAMES = "project-files";
const ALLOWED_EXTENSIONS = ["ifc", "ttl", "pdf"] as const;
const ALLOWED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;
const FOLDER_MARKER = ".folder";

interface ProjectFileInfo {
    fileId: string;
    fileName: string;
    size: number;
    lastModified?: Date;
}

function buildObjectName(
    projectId: string,
    folder: string,
    fileId: string,
    fileName: string
): string {
    return `${projectId}/${folder}/${fileId}_${fileName}`;
}

function validateExtension(fileName: string): void {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (
        !extension ||
        !(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)
    ) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid file type. Only ${ALLOWED_EXTENSIONS.join(", ")} files are allowed.`
        });
    }
}

function validateImageExtension(fileName: string): void {
    const extension = fileName.split(".").pop()?.toLowerCase();
    if (
        !extension ||
        !(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
    ) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid image type. Only ${ALLOWED_IMAGE_EXTENSIONS.join(", ")} files are allowed.`
        });
    }
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
            validateImageExtension(input.fileName);

            const fileId = crypto.randomUUID();
            const objectKey = buildCoverObjectName(
                input.projectId,
                fileId,
                input.fileName
            );

            const uploadUrl = await PresignedService.generatePresignedUploadUrl(
                {
                    bucketName: BUCKET_NAME,
                    objectName: objectKey,
                    expiry: 120
                }
            );

            return { uploadUrl, objectKey };
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
                await BucketService.deleteFile(BUCKET_NAME, previousKey);
            }

            return { coverImageUrl: await getCoverImageUrl(input.objectKey) };
        }),

    removeCoverImage: projectOwnerProcedure.mutation(async ({ input }) => {
        const project = await EntityService.getEntityById(input.projectId);
        if (project?.coverImageKey) {
            await BucketService.deleteFile(BUCKET_NAME, project.coverImageKey);
        }

        await EntityService.updateEntity(input.projectId, {
            coverImageKey: null
        });
        return { success: true };
    }),

    listFiles: projectEditorProcedure.query(async ({ input }) => {
        const objects = await BucketService.listFiles({
            bucketName: BUCKET_NAME,
            prefix: `${input.projectId}/`,
            recursive: true
        });

        const filesByFolder = new Map<string, ProjectFileInfo[]>();

        for (const object of objects) {
            const parts = object.name?.split("/") ?? [];
            const folder = parts[1];
            const fullName = parts[parts.length - 1];
            if (!folder || !fullName || folder === COVER_IMAGE_FOLDER) {
                continue;
            }

            if (!filesByFolder.has(folder)) {
                filesByFolder.set(folder, []);
            }
            if (fullName === FOLDER_MARKER) {
                continue;
            }

            const separatorIndex = fullName.indexOf("_");
            const fileId =
                separatorIndex >= 0
                    ? fullName.slice(0, separatorIndex)
                    : "unknown";
            const fileName =
                separatorIndex >= 0
                    ? fullName.slice(separatorIndex + 1)
                    : fullName;

            filesByFolder.get(folder)!.push({
                fileId,
                fileName,
                size: object.size,
                lastModified: object.lastModified
            });
        }

        return Array.from(filesByFolder.entries()).map(([folder, files]) => ({
            folder,
            files
        }));
    }),

    createFolder: projectEditorProcedure
        .input(z.object({ folder: z.string().min(1) }))
        .mutation(async ({ input }) => {
            const objectName = `${input.projectId}/${input.folder}/${FOLDER_MARKER}`;
            await BucketService.uploadBuffer(
                BUCKET_NAME,
                objectName,
                Buffer.alloc(0)
            );
            return { folder: input.folder };
        }),

    getUploadUrl: projectEditorProcedure
        .input(z.object({ folder: z.string().min(1), fileName: z.string() }))
        .mutation(async ({ input }) => {
            validateExtension(input.fileName);

            const fileId = crypto.randomUUID();
            const objectName = buildObjectName(
                input.projectId,
                input.folder,
                fileId,
                input.fileName
            );

            const uploadUrl = await PresignedService.generatePresignedUploadUrl(
                {
                    bucketName: BUCKET_NAME,
                    objectName,
                    expiry: 120
                }
            );

            return { uploadUrl, objectName, fileId };
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
            const objectName = buildObjectName(
                input.projectId,
                input.folder,
                input.fileId,
                input.fileName
            );
            await BucketService.deleteFile(BUCKET_NAME, objectName);
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
            const objectName = buildObjectName(
                input.projectId,
                input.folder,
                input.fileId,
                input.fileName
            );

            const fileStream = await BucketService.readFile(
                BUCKET_NAME,
                objectName
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
