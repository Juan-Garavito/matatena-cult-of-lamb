/**
 * Vercel Function entrypoint.
 *
 * Vercel serves this file at `/api/server` and owns the listener, so the
 * module only re-exports the HTTP server built in `src/server/server.ts`
 * (which skips `listen()` when `process.env.VERCEL` is set).
 *
 * Every route reaches this function through the catch-all rewrite in
 * `vercel.json`, including the Socket.IO upgrade request.
 */
import server from "../src/server/server.js";

export default server;
