/**
 * Vercel Function entrypoint.
 *
 * Vercel serves this file at `/api/server` and owns the listener, so the module
 * only re-exports the Express app built in `src/server/server.ts`, which skips
 * `listen()` when `process.env.VERCEL` is set.
 *
 * Every request that is not a static asset reaches this function through the
 * catch-all rewrite in `vercel.json`.
 */
import app from "../src/server/server.js";

export default app;
