import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const ignorePatterns = [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/cache/**",
    "**/.next/**",
    "**/generated/**",
    "**/.venv/**"
];

export default defineConfig([
    globalIgnores(ignorePatterns),
    {
        files: ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx,mts,cts}"],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_"
                }
            ]
        }
    }
]);
