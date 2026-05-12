import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

const createBackendLauncherPlugin = () => {
  let backendProcess: ChildProcessWithoutNullStreams | null = null;

  return {
    name: "dev-backend-launcher",
    configureServer(server: {
      middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void };
      config: { root: string };
    }) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/__dev/start-building-api" || req.method !== "POST") {
          next();
          return;
        }

        const respond = (statusCode: number, payload: Record<string, unknown>) => {
          res.statusCode = statusCode;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        };

        if (backendProcess && !backendProcess.killed) {
          respond(200, { started: true, alreadyRunning: true });
          return;
        }

        const backendSrc = path.resolve(server.config.root, "../src");
        backendProcess = spawn(
          "python",
          ["-m", "uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
          {
            cwd: backendSrc,
            stdio: "ignore",
            env: {
              ...process.env,
              FUSEKI_BASE_URL: process.env.FUSEKI_BASE_URL ?? "http://localhost:3030",
              FUSEKI_DATASET: process.env.FUSEKI_DATASET ?? "spine",
              FUSEKI_USERNAME: process.env.FUSEKI_USERNAME ?? "admin",
              FUSEKI_PASSWORD: process.env.FUSEKI_PASSWORD ?? "admin123",
              FUSEKI_TIMEOUT_SECONDS: process.env.FUSEKI_TIMEOUT_SECONDS ?? "600",
            },
            windowsHide: true,
          }
        );

        backendProcess.on("exit", () => {
          backendProcess = null;
        });

        respond(200, { started: true, alreadyRunning: false });
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const fusekiBaseUrl = process.env.FUSEKI_BASE_URL ?? "http://localhost:3030";
  const fusekiDataset = process.env.FUSEKI_DATASET ?? "spine";
  const fusekiUrl = new URL(fusekiBaseUrl);
  const fusekiTarget = `${fusekiUrl.protocol}//${fusekiUrl.host}`;
  const fusekiPathPrefix = fusekiUrl.pathname.replace(/\/$/, "");
  const fusekiAuthHeader =
    process.env.FUSEKI_USERNAME != null
      ? `Basic ${Buffer.from(`${process.env.FUSEKI_USERNAME}:${process.env.FUSEKI_PASSWORD ?? ""}`).toString("base64")}`
      : undefined;

  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/__fuseki/sparql": {
        target: fusekiTarget,
        changeOrigin: true,
        headers: fusekiAuthHeader ? { Authorization: fusekiAuthHeader } : undefined,
        rewrite: () => `${fusekiPathPrefix}/${fusekiDataset}/sparql`,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "development" && createBackendLauncherPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "three/examples/jsm/utils/BufferGeometryUtils": path.resolve(__dirname, "./src/lib/three-buffer-geometry-utils-shim.ts"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  };
});
