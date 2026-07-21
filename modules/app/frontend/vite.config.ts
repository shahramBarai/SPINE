import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { env } from "./src/utils/config";

export default defineConfig(() => {
    return {
        plugins: [react()],
        define: {
            __BACKEND_URL__: JSON.stringify(env.BACKEND_URL)
        },
        server: {
            host: "0.0.0.0",
            port: 3000
        },
        resolve: {
            alias: {
                utils: resolve(__dirname, "src", "utils"),
                components: resolve(__dirname, "src", "components"),
                hooks: resolve(__dirname, "src", "hooks"),
                pages: resolve(__dirname, "src", "pages"),
                layouts: resolve(__dirname, "src", "layouts")
            }
        }
    };
});
