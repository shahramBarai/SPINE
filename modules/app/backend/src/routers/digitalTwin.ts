import z from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import {
    PresignedService,
    type BUCKET_NAMES,
    BucketService
} from "@spine/storage-minio";
import {
    DatasetService,
    BuildingGraphService,
    FusekiSparqlError
} from "@spine/storage-rdf-store";
import { EntityService } from "@spine/storage-platform";
import { Readable } from "stream";

// FusekiSparqlError with status 404 covers two "no data yet" cases: the
// project's dataset hasn't been provisioned, or the dataset exists but this
// file's graph is empty/unsynced (see resolve_focus_uri). Surface both as a
// typed NOT_FOUND instead of a raw 500 so the UI can show a specific
// "no data yet" message rather than a generic error.
function rethrowMissingDataset(error: unknown): never {
    if (error instanceof FusekiSparqlError && error.status === 404) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
            cause: error
        });
    }

    throw error;
}

function buildTtlGraphUri(discipline: string, fileId: string): string {
    return `urn:spine:${discipline}:${fileId}`;
}

interface FileInfo {
    discipline: string;
    fileId: string;
    fileName: string;
    size: number;
    lastModified?: Date;
}

// TODO: This need to be moved from this file to a more appropriate place (e.g. service layer)
interface FloorInfo {
    key: string;
    label: string;
}

async function readStreamToText(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
            continue;
        }

        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("utf-8");
}

function parseIfcFloorOptions(ifcText: string): FloorInfo[] {
    const storeyRegex = /IFCBUILDINGSTOREY\(([^;]*)\);/gi;
    const quoteRegex = /'([^']*)'/g;
    const uniqueByLabel = new Set<string>();
    const floors: FloorInfo[] = [];
    let match: RegExpExecArray | null = storeyRegex.exec(ifcText);

    while (match) {
        const rawArgs = match[1] || "";
        const quotedValues = Array.from(rawArgs.matchAll(quoteRegex)).map(
            (value) => value[1] || ""
        );

        const candidateName =
            quotedValues.find((value) => value && value !== "$") || "";

        const label = candidateName.trim();

        if (label && !uniqueByLabel.has(label)) {
            uniqueByLabel.add(label);
            floors.push({
                key: label.toLowerCase().replace(/\s+/g, "-"),
                label
            });
        }

        match = storeyRegex.exec(ifcText);
    }

    return floors.sort((left, right) => left.label.localeCompare(right.label));
}

// -----------------------------------------------------------------------------

export const digitalTwinRouter = router({
    // Projects visible to the caller: public projects, plus (if logged in)
    // any project they are a member of.
    getProjects: publicProcedure.query(async ({ ctx }) => {
        return await EntityService.getVisibleProjects(
            ctx.session.data?.user?.id
        );
    }),

    // A single project by id, plus rootId - the default relationship-graph
    // focus, resolved project-wide across every synced graph (see
    // BuildingGraphService.get_root_id). Lets the digital-twin page resolve
    // the active project directly instead of fetching the whole
    // visible-projects list and filtering by id.
    getProject: publicProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ input }) => {
            const project = await EntityService.getEntityById(input.projectId);
            if (!project) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Project not found: ${input.projectId}`
                });
            }
            const rootId = await BuildingGraphService.get_root_id(
                input.projectId
            ).catch(rethrowMissingDataset);

            return { ...project, rootId };
        }),

    // Creates a project and its dedicated Fuseki dataset together. If dataset
    // provisioning fails, the project row is rolled back so a project never
    // exists without its Fuseki storage.
    createProject: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                isPublic: z.boolean().optional()
            })
        )
        .mutation(async ({ ctx, input }) => {
            const project = await EntityService.createEntity({
                name: input.name,
                description: input.description,
                type: "PROJECT",
                isPublic: input.isPublic ?? false,
                members: [{ userId: ctx.user.id, role: "OWNER" }]
            });

            try {
                await DatasetService.createDataset(project.id);
            } catch (error) {
                await EntityService.deleteEntity(project.id);
                throw error;
            }

            return project;
        }),

    getProjectFilesInfo: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                // Omit to list files across every discipline in the project
                // (e.g. GraphPane gathering all synced TTL graphs at once).
                discipline: z.string().optional(),
                fileTypes: z.array(z.enum(["ifc", "ttl", "pdf"]))
            })
        )
        .query(async ({ input }): Promise<FileInfo[]> => {
            const bucketName: BUCKET_NAMES = "project-files"; // Replace with your true runtime BUCKET_NAMES key

            const filesInfo = await BucketService.listFiles({
                bucketName,
                prefix: input.discipline
                    ? `${input.projectId}/${input.discipline}`
                    : `${input.projectId}/`,
                recursive: true
            });

            const fileTypesAsString = input.fileTypes.map((type) =>
                type.toLocaleLowerCase()
            );
            const result = filesInfo
                .filter((file) => {
                    const fileExtension = file.name
                        ?.split(".")
                        .pop()
                        ?.toLowerCase();
                    if (!fileExtension) {
                        return false;
                    }
                    return fileTypesAsString.includes(fileExtension);
                })
                .map((file) => {
                    const parts = file.name!.split("/");
                    const discipline = parts[1] || "unknown";
                    const fullName = parts[parts.length - 1] || "";
                    const separatorIndex = fullName.indexOf("_");
                    const fileId =
                        separatorIndex >= 0
                            ? fullName.slice(0, separatorIndex)
                            : "unknown";
                    const fileName =
                        separatorIndex >= 0
                            ? fullName.slice(separatorIndex + 1)
                            : fullName || "unknown";

                    return {
                        discipline,
                        fileId: fileId || "unknown",
                        fileName: fileName || "unknown",
                        size: file.size,
                        lastModified: file.lastModified
                    };
                });

            return result;
        }),

    getPresignedUploadUrl: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                discipline: z.string(),
                fileName: z.string()
            })
        )
        .mutation(async ({ input }) => {
            // Validate file name and type
            const fileExtension = input.fileName
                .split(".")
                .pop()
                ?.toLowerCase();
            if (!fileExtension || !["ifc", "ttl"].includes(fileExtension)) {
                throw new Error(
                    "Invalid file type. Only .ifc and .ttl files are allowed."
                );
            }

            // Get project info
            const projectInfo = {
                id: input.projectId,
                name: "Project Name",
                disciplineId: input.discipline
            };

            // Generate a secure storage path name
            const uniqueId = crypto.randomUUID();
            const objectName = `${projectInfo.id}/${projectInfo.disciplineId}/${uniqueId}_${input.fileName}`;

            const bucketName: BUCKET_NAMES = "project-files"; // Replace with your true runtime BUCKET_NAMES key

            console.log("Generating presigned upload URL for:", {
                bucketName,
                objectName
            });
            const uploadUrl = await PresignedService.generatePresignedUploadUrl(
                {
                    bucketName: bucketName,
                    objectName: objectName,
                    expiry: 120 // Link valid for 2 minutes
                }
            );

            console.log("Generated presigned upload URL:", uploadUrl);

            return { uploadUrl, objectName };
        }),

    deleteProjectFile: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                discipline: z.string(),
                fileId: z.string(),
                fileName: z.string()
            })
        )
        .mutation(async ({ input }) => {
            const bucketName: BUCKET_NAMES = "project-files"; // Replace with your true runtime BUCKET_NAMES key
            const objectName = `${input.projectId}/${input.discipline}/${input.fileId}_${input.fileName}`;

            await BucketService.deleteFile(bucketName, objectName);
        }),

    getIfcFloorOptions: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                discipline: z.string(),
                fileId: z.string(),
                fileName: z.string()
            })
        )
        .query(async ({ input }): Promise<FloorInfo[]> => {
            const bucketName: BUCKET_NAMES = "project-files";
            const objectName = `${input.projectId}/${input.discipline}/${input.fileId}_${input.fileName}`;

            const fileStream = await BucketService.readFile(
                bucketName,
                objectName
            );

            if (!fileStream) {
                return [];
            }

            const ifcText = await readStreamToText(fileStream);

            return parseIfcFloorOptions(ifcText);
        }),

    syncTtlToFuseki: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                discipline: z.string(),
                fileId: z.string(),
                fileName: z.string()
            })
        )
        .mutation(async ({ input }) => {
            const bucketName: BUCKET_NAMES = "project-files";
            const objectName = `${input.projectId}/${input.discipline}/${input.fileId}_${input.fileName}`;

            const fileStream = await BucketService.readFile(
                bucketName,
                objectName
            );
            if (!fileStream) {
                throw new Error(`TTL file not found: ${input.fileName}`);
            }

            const ttlContent = await readStreamToText(fileStream);
            const graphUri = buildTtlGraphUri(input.discipline, input.fileId);

            await DatasetService.uploadTtlToFuseki(
                input.projectId,
                Buffer.from(ttlContent, "utf-8"),
                graphUri,
                true // replace: re-syncing a file should not duplicate its triples
            );

            return { graphUri };
        }),

    getGraphTree: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                discipline: z.string(),
                fileId: z.string()
            })
        )
        .query(async ({ input }) => {
            const graphUri = buildTtlGraphUri(input.discipline, input.fileId);

            return await BuildingGraphService.get_tree(
                input.projectId,
                graphUri
            ).catch(rethrowMissingDataset);
        }),

    getRelationshipGraph: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                // Every graph the relationship search should span - lets
                // links that live in one file's graph (e.g. the "Linkset"
                // discipline) connect nodes from other visible files.
                files: z
                    .array(
                        z.object({
                            discipline: z.string(),
                            fileId: z.string()
                        })
                    )
                    .min(1),
                focusId: z.string(),
                includeNodeTypes: z.array(z.string()).optional(),
                includePredicates: z.array(z.string()).optional()
            })
        )
        .query(async ({ input }) => {
            const graphUris = input.files.map((file) =>
                buildTtlGraphUri(file.discipline, file.fileId)
            );

            return await BuildingGraphService.get_relationship_graph(
                input.projectId,
                graphUris,
                input.focusId,
                {
                    includeNodeTypes: input.includeNodeTypes,
                    includePredicates: input.includePredicates
                }
            ).catch(rethrowMissingDataset);
        })
});
