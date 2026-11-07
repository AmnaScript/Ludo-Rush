# Ludo Rush — Phase 0

A multiplayer Ludo web game built step-by-step from the supplied 13-page specification. **This repository implements Phase 0 only.**

## Requirements
- Node.js 20.19+ or 22.12+ (recommended: Node 22)
- npm 10+

## Install and run

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev
```

For Windows PowerShell, replace `cp` with `Copy-Item`.

- Client: http://localhost:5173
- Server health endpoint: http://localhost:5000/api/health
- In the client, wait for **Online** and click **Send socket ping**. Expect `PONG received at ...`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Repo structure

- `shared/src`: shared TypeScript socket contracts. **Rules engine comes in Phase 1**.
- `server/src`: Express health endpoint and typed Socket.IO ping handler.
- `client/src`: React, Tailwind v4, Zustand state and minimal Phaser scene.

## Technical notes
- npm workspaces link `@ludo-rush/shared` into client and server.
- Socket.IO is server-authoritative by design; no gameplay commands implemented yet.
- `.env` is ignored by git. Copy the examples and adjust ports/origins if needed.
- For deployment later, use a host that supports continuously connected WebSockets; free instances can sleep.
- No MongoDB is needed for Phase 0; game persistence is optional later.

## Acceptance criteria
1. Express health endpoint returns JSON.
2. React app and Phaser canvas display correctly.
3. Socket connects and the ping button receives a real `pong` acknowledgement.
4. Lint, typecheck and build succeed.

**Next phase (only after acceptance):** shared deterministic rules engine and unit tests.
