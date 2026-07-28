import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../../trpc";
import { projectEditorProcedure } from "../../procedures/project";
import { FileService } from "@spine/storage-platform";
import { ProjectFileService } from "@spine/storage-minio";
import { SemanticSearchService } from "@spine/storage-rdf-store";
import { readStreamToText } from "../../utils/stream";
import { getMimeType } from "../../utils/secureFile";
import { asBadRequest } from "./shared";

// Keeps saved query names safe as object-storage keys and download
// filenames across platforms - no "/", ".", or other path/extension-like
// characters that could collide with the .rq suffix or be misread as a
// nested folder.
const QUERY_NAME_REGEX = /^[a-zA-Z0-9 _-]+$/;

function assertValidQueryName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Enter a name for this query."
        });
    }
    if (trimmed.length > 100) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Query name must be 100 characters or fewer."
        });
    }
    if (!QUERY_NAME_REGEX.test(trimmed)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message:
                "Query name can only contain letters, numbers, spaces, hyphens, and underscores."
        });
    }
    return trimmed;
}

// Backs SemanticSearchSection/index.tsx and SavedQueriesBar.
export const semanticSearchRouter = router({
    runSemanticSearch: projectEditorProcedure
        .input(z.object({ query: z.string().min(1) }))
        .query(async ({ input }) => {
            try {
                return await SemanticSearchService.executeSemanticSearchQuery(
                    input.projectId,
                    input.query
                );
            } catch (error) {
                throw asBadRequest(error, "Failed to execute SPARQL query");
            }
        }),

    // Lists the project's saved queries by name only - deliberately not
    // reading each .rq file's contents here, so picking one from the
    // examples dropdown is what triggers loading its text (see
    // getSemanticSearchQuery), not this list.
    listSemanticSearchQueries: projectEditorProcedure.query(
        async ({ input }) => {
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
                    name: ProjectFileService.parseSavedQueryName(
                        file.fileName
                    )
                }));
        }
    ),

    // Reads a single saved query's text, for when the user actually selects
    // it from the examples dropdown.
    getSemanticSearchQuery: projectEditorProcedure
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
        }),

    // Persists a SPARQL query as a .rq file in the project's saved-queries
    // folder, rejecting names that are empty/unsafe or already taken so the
    // user gets a chance to rename rather than silently overwriting. The
    // query name itself (plus ".rq") is used as the fileId, since it's
    // already unique and human-chosen - no separate id needs minting.
    saveSemanticSearchQuery: projectEditorProcedure
        .input(z.object({ name: z.string(), query: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
            const name = assertValidQueryName(input.name);
            const fileId = ProjectFileService.buildSavedQueryFileName(name);

            const existing = await FileService.getFile(
                input.projectId,
                fileId
            );
            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `A saved query named "${name}" already exists. Choose a different name.`
                });
            }

            try {
                const content = Buffer.from(input.query, "utf-8");
                const objectKey = await ProjectFileService.saveFile(
                    input.projectId,
                    fileId,
                    content,
                    ProjectFileService.ALLOWED_EXTENSIONS.file,
                    ProjectFileService.ReservedFolder.SavedQueries
                );

                const file = await FileService.createFile({
                    id: fileId,
                    entityId: input.projectId,
                    fileName: fileId,
                    size: content.length,
                    mimeType: getMimeType(fileId),
                    objectKey,
                    createdBy: ctx.user.id
                });

                return { fileId: file.id, name };
            } catch (error) {
                throw asBadRequest(error, "Failed to save query");
            }
        })
});
