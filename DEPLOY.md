# Deploying to Vercel

The `vercel` branch carries the platform-specific deploy config (`vercel.json`,
`api/server.ts`, the `!process.env.VERCEL` listen guard) on top of the app code
from `main`. `main` stays free of Vercel-specific files so the game can be
hosted anywhere else.

## Architecture: why this works on serverless

Live updates go through **Supabase Realtime**, not a socket held open by the
server. The browser subscribes **directly to Supabase**; the Vercel Function
only handles plain HTTP requests and fires broadcasts to Supabase over REST.

That is the whole reason this deploys cleanly: Vercel Functions are ephemeral
and stateless, so they cannot hold WebSocket connections or share in-memory
state across instances. By keeping realtime in Supabase (an external, always-on
service), none of that matters — every function invocation is request/response.

## Required environment variables

Set these in **Project Settings → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL (used by server and client) |
| `SUPABASE_ANON_KEY` | yes | Public key injected into the browser via `/js/env.js` — relies on RLS, safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side only — used for REST broadcasts and DB writes |
| `SUPABASE_DB_URL` | yes | Session-mode string, **port 5432** (not pgbouncer 6543) |
| `GOOGLE_API_KEY` | yes | Gemini key |
| `GOOGLE_MODEL` | yes | e.g. `gemini-2.5-flash` |
| `API_URL` | yes | Deployment URL, e.g. `https://matatena.vercel.app` |
| `AGENT_TIMEOUT_MS` | no | Per model call. Defaults to `20000` |
| `PORT` | no | Ignored on Vercel |

`VERCEL` is injected by the platform and makes `src/server/server.ts` skip
`listen()`, exporting the HTTP server instead (imported by `api/server.ts`).

There is **no** `SOCKET_PATH`, no Fluid-compute requirement, and no WebSocket
beta feature to enable — the client never opens a socket to the function.

## The one real serverless constraint: the AI turn

The singleplayer bot runs a LangGraph agent **inside** the request that triggers
it (`/create-game`, `/play`). That agent makes several sequential Gemini calls
(up to `AGENT_TIMEOUT_MS` each), so a bot turn can take well over 10 seconds.

`vercel.json` sets `maxDuration: 60`, which covers it — but **the free plan caps
functions at 10s**, where a slow bot turn will be killed mid-thought. To run on
free, the bot turn must be moved out of the request (a queue/worker such as
Inngest or QStash). On a paid plan, the inline `await` fits inside 60s.

Any artificial "thinking" delay for the bot belongs on the **client**, never as
a server-side sleep — serverless bills execution time.

## Alternative: a single long-lived host

If you would rather not deal with the serverless timeout at all, the same
Express app runs unchanged on a host that keeps one process alive (Railway,
Render, Fly.io): `npm run build && npm start`, plus serving `src/public`.
Supabase Realtime works there too, so nothing else changes.
