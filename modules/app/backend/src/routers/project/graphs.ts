import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../../trpc";
import { projectEditorProcedure } from "../../procedures/project";
import { FileService } from "@spine/storage-platform";
import { ProjectFileService } from "@spine/storage-minio";
import { DatasetService } from "@spine/storage-rdf-store";
import { readStreamToText } from "../../utils/stream";
import { asBadRequest } from "./shared";

// Backs FilesOverviewTab/FusekiGraphsSection and
// modals/UploadTtlToGraphModal.
export const graphsRouter = router({
    listGraphs: projectEditorProcedure.query(async ({ input }) => {
        return await DatasetService.read_list_graphs(input.projectId);
    }),

    createGraph: projectEditorProcedure
        .input(z.object({ graphUri: z.string().min(1) }))
        .mutation(async ({ input }) => {
            if (input.graphUri === "default") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default graph always exists"
                });
            }

            try {
                await DatasetService.createGraph(
                    input.projectId,
                    input.graphUri
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid graph URI");
            }

            return { graphUri: input.graphUri };
        }),

    renameGraph: projectEditorProcedure
        .input(
            z.object({
                oldUri: z.string().min(1),
                newUri: z.string().min(1)
            })
        )
        .mutation(async ({ input }) => {
            if (input.oldUri === "default" || input.newUri === "default") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default graph cannot be renamed"
                });
            }

            try {
                await DatasetService.renameGraph(
                    input.projectId,
                    input.oldUri,
                    input.newUri
                );
            } catch (error) {
                throw asBadRequest(error, "Invalid graph URI");
            }

            return { graphUri: input.newUri };
        }),

    deleteGraph: projectEditorProcedure
        .input(z.object({ graphUri: z.string().min(1) }))
        .mutation(async ({ input }) => {
            if (input.graphUri === "default") {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "The default graph cannot be deleted"
                });
            }

            await DatasetService.deleteGraph(input.projectId, input.graphUri);
            return { success: true };
        }),

    loadTtlToFuseki: projectEditorProcedure
        .input(
            z.object({
                fileId: z.string(),
                graphUri: z.string().min(1),
                replace: z.boolean().default(false)
            })
        )
        .mutation(async ({ input }) => {
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

            const ttlContent = await readStreamToText(fileStream);
            try {
                await DatasetService.uploadTtlToFuseki(
                    input.projectId,
                    Buffer.from(ttlContent, "utf-8"),
                    input.graphUri,
                    input.replace
                );
            } catch (error) {
                throw asBadRequest(error, "Failed to load TTL into Fuseki");
            }

            return { graphUri: input.graphUri };
        })
});
