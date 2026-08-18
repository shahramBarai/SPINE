// See vite.config.ts's `define` - this is baked in at build time from the
// shared workspace env (packages/shared/.env's BACKEND_URL), so it stays in
// sync with the backend without duplicating the literal here.
const BACKEND_URL = __BACKEND_URL__;

export { BACKEND_URL };
