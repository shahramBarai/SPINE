import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { flinkRequest } from "./utils/flinkClient";
import { logger } from "./utils/logger";

const execAsync = promisify(exec);

// Health check endpoint
export async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    const flinkHealth = await flinkRequest("/overview");
    res.json({
      status: "healthy",
      flink_status: "connected",
      flink_version: flinkHealth.data["flink-version"] || "unknown",
    });
  } catch (error) {
    res.status(200).json({
      status: "unhealthy",
      flink_status: "disconnected",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// List all jobs
export async function listJobs(req: Request, res: Response): Promise<void> {
  try {
    const response = await flinkRequest("/jobs");
    res.json(response.data);
  } catch (error) {
    logger.error("Error listing jobs", { error });
    res.status(500).json({
      error: "Failed to list jobs",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Get details for a specific job
export async function getJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  try {
    const response = await flinkRequest(`/jobs/${jobId}`);
    res.json(response.data);
  } catch (error) {
    logger.error(`Error getting job ${jobId}`, { error });
    res.status(500).json({
      error: `Failed to get job ${jobId}`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Upload JAR file
export async function uploadFile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const file = req.file;
    const filePath = file.path;
    const fileName = file.originalname;

    if (!fileName.endsWith(".jar")) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: "Only JAR files are allowed" });
      return;
    }

    // Upload JAR file to Flink
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    formData.append("jarfile", new Blob([fileBuffer]), fileName);

    try {
      const response = await flinkRequest("/jars/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-java-archive",
        },
        data: formData,
      });

      // Extract jar ID from response
      const jarId = response.data.filename.split("/").pop();
      res.json({ jar_id: jarId });
    } catch (error) {
      logger.error("Error uploading JAR file", { error });
      res.status(500).json({
        error: "Failed to upload JAR file",
        details: error instanceof Error ? error.message : String(error),
      });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);
  } catch (error) {
    logger.error("Error processing file upload", { error });
    res.status(500).json({
      error: "Failed to process file upload",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Run a JAR job
export async function runJob(req: Request, res: Response): Promise<void> {
  try {
    const { jar_id, entry_class, program_args } = req.body;

    if (!jar_id) {
      res.status(400).json({ error: "jar_id is required" });
      return;
    }

    const payload: Record<string, string> = {};
    if (entry_class) payload.entryClass = entry_class;
    if (program_args) payload.programArgs = program_args;

    const response = await flinkRequest(`/jars/${jar_id}/run`, {
      method: "POST",
      data: payload,
    });

    res.json({ job_id: response.data.jobid });
  } catch (error) {
    logger.error("Error running JAR job", { error });
    res.status(500).json({
      error: "Failed to run JAR job",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Stop a running job
export async function stopJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  try {
    await flinkRequest(`/jobs/${jobId}/stop`, {
      method: "POST",
    });
    res.json({ message: `Job ${jobId} stopped` });
  } catch (error) {
    logger.error(`Error stopping job ${jobId}`, { error });
    res.status(500).json({
      error: `Failed to stop job ${jobId}`,
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// Get logs for a job
export async function getJobLogs(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  try {
    const response = await flinkRequest(`/jobs/${jobId}/exceptions`);
    res.json(response.data);
  } catch (error) {
    res.json({ message: "Logs not available or job not found" });
  }
}
