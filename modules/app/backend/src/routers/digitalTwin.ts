import z from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { ProjectFileService } from "@spine/storage-minio";
import {
    DatasetService,
    BuildingGraphService,
    RelationshipGraphService,
    SemanticSearchService,
    FusekiSparqlError
} from "@spine/storage-rdf-store";
import { EntityService, FileService } from "@spine/storage-platform";
import { twinProjectProcedure } from "../procedures/project";
import { getCoverImageUrl } from "../utils/coverImage";
import { readStreamToText } from "../utils/stream";

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

interface FileInfo {
    discipline: string;
    fileId: string;
    fileName: string;
    size: number;
    lastModified?: Date;
}

// -----------------------------------------------------------------------------

export const digitalTwinRouter = router({
    // Projects visible to the caller: twin-enabled projects, plus (if logged
    // in) any project they are a member of.
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
    getProject: twinProjectProcedure.query(async ({ ctx, input }) => {
        const rootId = await BuildingGraphService.get_root_id(
            input.projectId
        ).catch((error) => {
            if (error instanceof FusekiSparqlError && error.status === 404) {
                return null;
            }
            throw error;
        });

        const coverImageUrl = getCoverImageUrl(ctx.project.coverImageKey);

        return { ...ctx.project, rootId, coverImageUrl };
    }),

    // Creates a project and its dedicated Fuseki dataset together. If dataset
    // provisioning fails, the project row is rolled back so a project never
    // exists without its Fuseki storage.
    createProject: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                type: z.enum(["DISTRICT", "CAMPUS", "BUILDING", "LAB"])
            })
        )
        .mutation(async ({ ctx, input }) => {
            const project = await EntityService.createEntity({
                name: input.name,
                description: input.description,
                type: input.type,
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

    getProjectFilesInfo: twinProjectProcedure
        .input(
            z.object({
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

    getGraphTree: twinProjectProcedure
        .input(
            z.object({
                discipline: z.string(),
                fileId: z.string()
            })
        )
        .query(async ({ input }) => {
            return await BuildingGraphService.get_tree(
                input.projectId,
                "DEFAULT"
            ).catch(rethrowMissingDataset);
        }),

    getRelationshipGraph: twinProjectProcedure
        .input(
            z.object({
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
        }),

    runSemanticSearch: twinProjectProcedure
        .input(z.object({ query: z.string().min(1) }))
        .query(async ({ input }) => {
            try {
                return await SemanticSearchService.executeSemanticSearchQuery(
                    input.projectId,
                    input.query
                );
            } catch (error) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to execute SPARQL query"
                });
            }
        }),

    listSemanticSearchQueries: twinProjectProcedure.query(async ({ input }) => {
        const files = await FileService.listFiles(input.projectId);
        return files
            .filter(
                (file) =>
                    ProjectFileService.getFolderFromObjectKey(
                        file.objectKey
                    ) === ProjectFileService.ReservedFolder.SavedQueries
            )
            .map((file) => ({
                fileId: file.id,
                name: ProjectFileService.parseSavedQueryName(file.fileName)
            }));
    }),

    getSemanticSearchQuery: twinProjectProcedure
        .input(z.object({ fileId: z.string() }))
        .query(async ({ input }) => {
            const file = await FileService.getFile(
                input.projectId,
                input.fileId
            );
            if (!file) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Saved query not found"
                });
            }

            const stream = await ProjectFileService.readFile(file.objectKey);
            if (!stream) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Saved query not found: ${file.fileName}`
                });
            }
            return { query: await readStreamToText(stream) };
        })
});
