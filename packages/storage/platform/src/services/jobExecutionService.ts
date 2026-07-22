import { prisma } from "../../prisma/client";
import { JobSource, JobExecutionStatus, Prisma } from "../../prisma/types";

/* -------------------------------- CREATE -------------------------------- */

/**
 * Log a new job execution (e.g. a tool run or, later, a Flink pipeline
 * run), immediately at QUEUED - before we know whether it'll succeed - so
 * every attempted run is captured even if nobody ever polls its status.
 * @param data - The data for the job execution
 * @param data.entityId - The project the job ran against
 * @param data.executedBy - The id of the user who started the job
 * @param data.source - Which kind of job this is (TOOL or FLINK)
 * @param data.jobKey - The tool id, or Pipeline id, that was run
 * @param data.externalJobId - The job id returned by the executing service, if known yet
 * @param data.input - A JSON snapshot of the job's input
 * @returns The created job execution
 */
async function createJobExecution(data: {
    entityId: string;
    executedBy: string;
    source: JobSource;
    jobKey: string;
    externalJobId?: string;
    input?: Prisma.InputJsonValue;
}) {
    return await prisma.jobExecution.create({
        data: {
            entityId: data.entityId,
            executedBy: data.executedBy,
            source: data.source,
            jobKey: data.jobKey,
            externalJobId: data.externalJobId,
            input: data.input
        }
    });
}

/* -------------------------------- READ -------------------------------- */

/**
 * Get a job execution by id
 * @param id - The id of the job execution
 * @returns The job execution or `null` if not found
 */
async function getJobExecutionById(id: string) {
    return await prisma.jobExecution.findUnique({ where: { id } });
}

/**
 * List a project's job executions, most recent first, with the executing
 * user's name/email attached for display in a job history list.
 * @param entityId - The id of the project
 * @param options.limit - Max number of results to return (default 20)
 * @returns An array of job executions
 */
async function listJobExecutions(entityId: string, options?: { limit?: number }) {
    return await prisma.jobExecution.findMany({
        where: { entityId },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 20,
        select: {
            id: true,
            source: true,
            jobKey: true,
            externalJobId: true,
            status: true,
            error: true,
            entityId: true,
            executedBy: true,
            createdAt: true,
            updatedAt: true,
            user: { select: { id: true, name: true, email: true } }
        }
    });
}

/* -------------------------------- UPDATE -------------------------------- */

/**
 * Update a job execution's status, result, and/or the external job id (if
 * it wasn't known at creation time). Called both when the caller acts on a
 * job (e.g. saving its result) and as a write-through cache whenever the
 * external service is polled for status.
 * @param id - The id of the job execution
 * @param data - The fields to update
 * @throws {Error} If the job execution does not exist
 * @returns The updated job execution
 */
async function updateJobExecution(
    id: string,
    data: {
        status?: JobExecutionStatus;
        externalJobId?: string;
        result?: Prisma.InputJsonValue;
        error?: string | null;
    }
) {
    const jobExecution = await getJobExecutionById(id);
    if (!jobExecution) {
        throw new Error(`Job execution with ID ${id} not found`);
    }

    return await prisma.jobExecution.update({
        where: { id },
        data: {
            ...data,
            updatedAt: new Date()
        }
    });
}

/* ------------------------------ EXPORTS -------------------------------- */
export {
    createJobExecution,
    getJobExecutionById,
    listJobExecutions,
    updateJobExecution
};
