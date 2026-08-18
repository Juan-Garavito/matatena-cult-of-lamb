/**
 * Vercel Function entrypoint.
 *
 * The catch-all rewrite in `vercel.json` routes every request that is not a
 * static asset here, and Vercel's Node runtime treats the exported Express app
 * as the request handler. `src/server/server.ts` skips `listen()` when
 * `process.env.VERCEL` is set, so importing it does not try to bind a port.
 */
import app from "../src/server/server.js";

export default app;
