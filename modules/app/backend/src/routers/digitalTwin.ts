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
import { EntityService } from "@spine/storage-platform";
import { getCoverImageUrl } from "../utils/coverImage";

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
            const folders = await ProjectFileService.listProjectFiles(
                input.projectId
            );
            const fileTypesLower = input.fileTypes.map((type) =>
                type.toLowerCase()
            );

            return folders
                .filter(
                    (folder) =>
                        !input.discipline || folder.folder === input.discipline
                )
                .flatMap((folder) =>
                    folder.files
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
                            discipline: folder.folder,
                            fileId: file.fileId,
                            fileName: file.fileName,
                            size: file.size,
                            lastModified: file.lastModified
                        }))
                );
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
