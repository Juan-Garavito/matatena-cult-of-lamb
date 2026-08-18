# Deploying to Vercel

The `vercel` branch carries the platform-specific pieces — `vercel.json`,
`api/server.ts`, the `!process.env.VERCEL` listen guard, `waitUntil` around the
agent, and `attachDatabasePool` on the Postgres pool — on top of the app code
from `main`. `main` stays free of Vercel-specific files so the game can be
hosted anywhere else.

Keep the branch current by merging `main` into it, never the other way around.

## Why this works on serverless

Live updates go through **Supabase Realtime**, not a socket held open by the
server. The browser subscribes directly to Supabase; the function only handles
plain HTTP requests and pushes broadcasts to Supabase over REST.

That is the whole reason this deploys cleanly. Vercel Functions are ephemeral,
so they cannot hold WebSocket connections. By keeping realtime in an external
always-on service, every function invocation stays request/response.

## Required environment variables

Set these in **Project Settings → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL, used by server and client |
| `SUPABASE_ANON_KEY` | yes | Injected into the browser via `/js/env.js`. Safe to expose — RLS is enabled and game channels are private |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server only. REST broadcasts and database writes; bypasses RLS |
| `SUPABASE_JWT_SECRET` | yes | Signs the per-game tokens that let a browser subscribe to its private channel. Dashboard → Settings → API → JWT Secret |
| `SUPABASE_DB_URL` | yes | Session-mode string, **port 5432**, not the transaction pooler on 6543 |
| `GOOGLE_API_KEY` | yes | Gemini key |
| `GOOGLE_MODEL` | yes | e.g. `gemini-3.1-flash-lite-preview` |
| `API_URL` | yes | Deployment URL, e.g. `https://matatena.vercel.app` |
| `AGENT_TIMEOUT_MS` | no | Per model call. Defaults to `20000` |
| `PORT` | no | Ignored on Vercel |

`VERCEL` is injected by the platform and makes `src/server/server.ts` skip
`listen()`. `api/server.ts` imports the exported Express app and Vercel binds it.

## Database migrations

Run `supabase db push` before the first deploy. Three migrations matter here:

- `0001` creates the tables and enables RLS. With no policies, `anon` is denied
  everything, which is correct — the browser never queries tables directly.
- `0002` authorizes the private Realtime channels. Without it every
  subscription is rejected and the board never updates.
- `0003` moves the bot's personality and skill level onto the `players` row.
  **This one is not optional on Vercel.** They previously lived in a
  module-level array, and serverless does not keep memory between invocations.

## Fluid Compute is required

Enable it in **Settings → Functions**. It is on by default for new projects.

`src/server/db/pool.ts` calls `attachDatabasePool(pool)`, which only does
anything under Fluid Compute — it releases idle Postgres clients before an
instance suspends. Without it, suspended instances hold connections open and
Supabase's connection limit is reached quickly. The pool also caps `max` at 2,
because serverless scales out with one pool per instance.

## The AI turn runs after the response

The singleplayer bot runs a LangGraph agent that makes several sequential Gemini
calls. It is started *after* the handler responds, so the request is not held
open waiting for it.

A bare floating promise would not survive: Vercel freezes the instance once the
response is sent. `src/server/server.ts` therefore wraps each agent run in
`waitUntil()`, which keeps the invocation alive until the promise settles.

Two limits apply:

- `vercel.json` sets `maxDuration: 300`, the Hobby maximum. Work passed to
  `waitUntil` shares that budget and is **cancelled** if the function times out.
- Separately, the proxied request timeout is 120s on every plan. That bounds the
  HTTP request itself, not the background work.

Any artificial "thinking" delay for the bot belongs on the client, never as a
server-side sleep — serverless bills execution time.

## What to expect on the Hobby plan

It fits comfortably. The limits worth knowing:

- **Active CPU: 4 CPU-hrs/month.** Billing pauses during I/O, and waiting on
  Gemini is I/O, so the agent costs far less than its wall-clock time suggests.
- **Invocations: 1M/month, Fast Data Transfer: 100 GB.** Not a concern here.
- **Runtime logs are kept 1 hour.** An overnight failure leaves no trace.
- **Cold starts.** The bundle carries Express plus LangChain, LangGraph and
  three model integrations, so the first request after an idle period is slow.
- Hobby cannot connect to repositories owned by a Git *organization*. A personal
  repository is fine.

## Alternative: a single long-lived host

The same Express app runs unchanged on a host that keeps one process alive
(Railway, Render, Fly.io): `npm run build && npm start`. None of this file
applies there — no `waitUntil`, no Fluid Compute, no pool tuning. Migration
`0003` still matters, since it fixes a bug that also bites across restarts.
