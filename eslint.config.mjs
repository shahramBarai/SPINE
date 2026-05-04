import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const ignorePatterns = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/generated/**",
];

const typeScriptFiles = [
  "packages/messaging/tsconfig.json",
  "packages/shared/tsconfig.json",
  "packages/ingress/tsconfig.json",
  "packages/storage/timescale/tsconfig.json",
  "packages/storage/minio/tsconfig.json",
  "packages/storage/platform/tsconfig.json",
  "modules/ingress/eb_subscriber/tsconfig.json",
  "modules/egress/mqtt-bridge/tsconfig.json",
  "modules/ingress/mqtt_subscriber_nodejs/tsconfig.json",
  "modules/app/webapp/tsconfig.json",
];

export default defineConfig([
  globalIgnores(ignorePatterns),
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        project: typeScriptFiles,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);