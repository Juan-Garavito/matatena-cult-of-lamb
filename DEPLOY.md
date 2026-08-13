# Deploying to Vercel

This configuration lives on the `vercel` branch only. `main` stays free of
platform-specific code so the game can be published anywhere else, so rebase
this branch onto `main` rather than merging it back.

## Required environment variables

Set these in **Project Settings → Environment Variables**:

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side only |
| `SUPABASE_DB_URL` | yes | Session-mode string, **port 5432** (not pgbouncer 6543) |
| `GOOGLE_API_KEY` | yes | Gemini key |
| `GOOGLE_MODEL` | yes | e.g. `gemini-2.5-flash` |
| `API_URL` | yes | Deployment URL, e.g. `https://matatena.vercel.app` |
| `SOCKET_PATH` | yes | Must be `/api/server/socket.io` on Vercel |
| `AGENT_TIMEOUT_MS` | no | Defaults to `20000` |
| `PORT` | no | Ignored on Vercel |

`VERCEL` is injected by the platform and makes `src/server/server.ts` skip
`listen()`, exporting the HTTP server instead.

## Requirements

- **Fluid compute must be enabled** (default for projects created after
  2025-04-23). WebSockets do not work without it.
- The **WebSockets** feature must be available on the account — it is in
  public beta as of June 2026.

## Known limitation: cross-instance broadcasting

This is the one that breaks the game, and it is not a configuration problem.

A WebSocket connection is pinned to a single function instance, but **new
connections are not guaranteed to reach the same instance**. Socket.IO keeps
its connection registry in memory, so `io.emit(...)` only reaches clients
attached to the instance that runs the emit.

What breaks as a result:

- **Multiplayer**: two players usually land on different instances, so
  neither sees the other's moves.
- **Singleplayer bot join**: `POST /create-game` runs in a different
  invocation than the one holding the player's socket, so the
  `sendGameState` emitted after the bot joins never arrives.

The fix is a Socket.IO adapter backed by an external store, which moves the
registry and the pub/sub out of process memory:

```bash
npm install @socket.io/redis-adapter redis
```

```ts
// src/server/socket.ts
io.adapter(createAdapter(pubClient, subClient));
```

Provision Redis from the Vercel Marketplace and wire the client with the
connection string it exposes. **Until this is done, only a single-instance
host behaves correctly.**

## Max duration

`vercel.json` sets `maxDuration: 60`. A WebSocket connection closes when the
function reaches that limit, so a match longer than 60 seconds will drop the
socket. `src/public/js/game.js` does not implement reconnect-with-backoff yet;
Socket.IO reconnects automatically, but any state held only in memory is lost.

Raise `maxDuration` on a paid plan if longer sessions are needed.

## Alternative: a single long-lived host

If the realtime behaviour matters more than the serverless model, deploying
the same Express + Socket.IO server to a host that keeps one process alive
(Railway, Render, Fly.io) needs no adapter and no `SOCKET_PATH` override —
`npm run build && npm start` is enough, plus copying `src/public` into the
build output.
