/// <reference types="vite/client" />

// Injected by vite.config.ts's `define` from the shared workspace env
// (packages/shared/.env's BACKEND_URL) at build time.
declare const __BACKEND_URL__: string;
