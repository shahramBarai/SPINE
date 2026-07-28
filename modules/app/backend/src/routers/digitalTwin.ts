import z from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { ProjectFileService } from "@spine/storage-minio";
import {
    DatasetService,
    BuildingGraphService,
    RelationshipGraphService,
    FusekiSparqlError
} from "@spine/storage-rdf-store";
import { EntityService, FileService } from "@spine/storage-platform";
import { getCoverImageUrl } from "../utils/coverImage";
import { readStreamToBuffer } from "../utils/stream";
import { IfcLiteServerClient } from "../clients";

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

// -----------------------------------------------------------------------------

export const digitalTwinRouter = router({
    // Projects visible to the caller: public projects, plus (if logged in)
    // any project they are a member of.
    getProjects: publicProcedure.query(async ({ ctx }) => {
        const projects = await EntityService.getVisibleProjects(
            ctx.session.data?.user?.id
        );

        return projects.map((project) => ({
            ...project,
            coverImageUrl: getCoverImageUrl(project.coverImageKey)
        }));
    }),

    // A single project by id, plus rootId - the default relationship-graph
    // focus. Each discipline keeps its own independent site/building/storey
    // skeleton (stitched together by owl:sameAs links in Linkset graphs), so
    // get_root_id is steered toward the architectural discipline's graphs
    // first for a stable default, falling back to any synced graph if ARK
    // isn't synced yet (see BuildingGraphService.get_root_id). Lets the
    // digital-twin page resolve the active project directly instead of
    // fetching the whole visible-projects list and filtering by id.
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

            // Empty fileId trims buildTtlGraphUri's output down to the
            // "urn:spine:disc-ark:" prefix shared by every ARK graph.
            const arkGraphPrefix = buildTtlGraphUri("disc-ark", "");
            const rootId = await BuildingGraphService.get_root_id(
                input.projectId,
                arkGraphPrefix
            ).catch(rethrowMissingDataset);

            const coverImageUrl = getCoverImageUrl(project.coverImageKey);

            return { ...project, rootId, coverImageUrl };
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
                discipline: z.string().optional(),
                fileTypes: z.array(z.enum(["ifc", "ttl", "pdf"]))
            })
        )
        .query(async ({ input }): Promise<FileInfo[]> => {
            const files = await FileService.listFiles(input.projectId);
            const fileTypesLower = input.fileTypes.map((type) =>
                type.toLowerCase()
            );

            return files
                .filter((file) => {
                    const folder = ProjectFileService.getFolderFromObjectKey(
                        file.objectKey
                    );
                    return !input.discipline || folder === input.discipline;
                })
                .filter((file) => {
                    const extension = file.fileName
                        .split(".")
                        .pop()
                        ?.toLowerCase();
                    return extension
                        ? fileTypesLower.includes(extension)
                        : false;
                })
                .map((file) => ({
                    discipline:
                        ProjectFileService.getFolderFromObjectKey(
                            file.objectKey
                        ) ?? "",
                    fileId: file.id,
                    fileName: file.fileName,
                    size: file.size,
                    lastModified: file.updatedAt
                }));
        }),

    // Streams an IFC file's geometry via the self-hosted ifc-lite-server so
    // the raw IFC bytes never need to reach the browser, and large files
    // render progressively instead of the viewer staying blank until the
    // whole file is parsed. publicProcedure to match this router's existing
    // public-project viewing model (getProject, getGraphTree, etc.) rather
    // than project.ts's member-only procedures.
    streamIfcGeometry: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                fileId: z.string()
            })
        )
        .subscription(async function* ({ input }) {
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

            const fileStream = await ProjectFileService.readFile(
                file.objectKey
            );
            if (!fileStream) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `File not found: ${file.fileName}`
                });
            }

            const buffer = await readStreamToBuffer(fileStream);

            try {
                yield* IfcLiteServerClient.streamIfcFile(buffer);
            } catch (error) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to stream IFC file geometry",
                    cause: error
                });
            }
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
                focusId: z.string(),
                includeNodeTypes: z.array(z.string()).optional(),
                excludeNodeTypes: z.array(z.string()).optional(),
                includePredicates: z.array(z.string()).optional()
            })
        )
        .query(async ({ input }) => {
            const graphs = await DatasetService.read_list_graphs(
                input.projectId
            );
            const graphUris = graphs.map((g) => g.uri);

            return await RelationshipGraphService.get_relationship_graph(
                input.projectId,
                graphUris,
                input.focusId,
                {
                    includeNodeTypes: input.includeNodeTypes,
                    excludeNodeTypes: input.excludeNodeTypes,
                    includePredicates: input.includePredicates
                }
            ).catch(rethrowMissingDataset);
        })
});
