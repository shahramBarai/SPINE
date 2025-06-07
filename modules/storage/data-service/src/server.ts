// src/server.ts
import { Fastify, fastifyCors } from "./deps";
import { logger } from "./utils/logger";
import { userRoutes } from "./routes/userRoutes";
import { projectRoutes } from "./routes/projectRoutes";
import "dotenv/config";

const startServer = async () => {
  try {
    const app = Fastify({
      logger,
    });

    // Register plugins
    await app.register(fastifyCors, {
      origin: true,
    });

    // Register routes
    await app.register(projectRoutes, { prefix: "/api" });
    await app.register(userRoutes, { prefix: "/api" });

    // Health check route
    app.get("/health", async () => {
      return { status: "ok" };
    });

    // Start server
    const port = parseInt(process.env.PORT || "3010", 10);
    const host = process.env.HOST || "0.0.0.0";

    await app.listen({ port, host });
    logger.info(`Server is running on http://${host}:${port}`);
  } catch (err) {
    logger.error(err, "Error starting server");
    process.exit(1);
  }
};

startServer();
