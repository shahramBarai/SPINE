import { Express } from "express";
import multer from "multer";
import {
  getHealth,
  listJobs,
  getJob,
  uploadFile,
  runJob,
  stopJob,
  getJobLogs,
} from "./controllers";

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

export function setupRoutes(app: Express): void {
  // Root endpoint
  app.get("/", (req, res) => {
    res.json({
      message: "Flink Job Submission API",
      version: "1.0.0",
      documentation: "/docs",
    });
  });

  // Health check
  app.get("/health", getHealth);

  // Job management
  app.get("/jobs", listJobs);
  app.get("/jobs/:jobId", getJob);
  app.post("/upload", upload.single("file"), uploadFile);
  app.post("/run", runJob);
  app.post("/stop/:jobId", stopJob);
  app.get("/logs/:jobId", getJobLogs);
}
