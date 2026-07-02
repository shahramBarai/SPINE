import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import crypto from "crypto";
import { Readable } from "stream";

import {
    PresignedService,
    type BUCKET_NAMES,
    BucketService
} from "@spine/storage-minio";

interface FileInfo {
    discipline: string;
    fileId: string;
    fileName: string;
    size: number;
    lastModified?: Date;
}

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

        console.log("Quoted values for IFCBUILDINGSTOREY:", quotedValues);

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

export const fileStorageRouter = router({
    getProjectFilesInfo: publicProcedure
        .input(
            z.object({
                projectId: z.string(),
                discipline: z.string(),
                fileTypes: z.array(z.enum(["ifc", "ttl", "pdf"]))
            })
        )
        .query(async ({ input }): Promise<FileInfo[]> => {
            const bucketName: BUCKET_NAMES = "project-files"; // Replace with your true runtime BUCKET_NAMES key

            const filesInfo = await BucketService.listFiles({
                bucketName,
                prefix: `${input.projectId}/${input.discipline}`,
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

    getProjectIfcFileFloors: publicProcedure
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
        })
});
