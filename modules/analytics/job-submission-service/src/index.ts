import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import swaggerUi from "swagger-ui-express";
import { logger } from "./utils/logger";
import { setupRoutes } from "./routes";

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const port = process.env.PORT || 80;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Swagger documentation
try {
  const swaggerDocument = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../openapi.json"), "utf8")
  );
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get("/openapi.json", (req, res) => {
    res.sendFile(path.join(__dirname, "../openapi.json"));
  });
} catch (error) {
  logger.warn("Swagger documentation not available", { error });
}

// Setup routes
setupRoutes(app);

// Start server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
  logger.info(`API documentation available at http://localhost:${port}/docs`);
});
