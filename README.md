# Ludo Rush

A multiplayer 3D Ludo web game: small people instead of tokens, three cartoon capture scenes (gun, slap, dog chase), rooms that fit any number of players, and live chat. Built from the 13-page project specification.

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
- Server health: http://localhost:5000/api/health

Open the client in two or more browser tabs: create a room in one, join with the code (or the invite link) in the others, then press **Start game**.

## What works today
- **Rooms and lobby:** 6-character codes, invite link, host settings (characters per player, seconds per turn), host-only start, spectators for late joiners, rematch.
- **Server-authoritative game:** the server rolls the dice (`crypto.randomInt`), validates every move with the shared rules engine, and picks the capture style.
- **Any player count:** 2 to 32 players, board generated from the player count.
- **Turn timer, bots and reconnect:** timeouts auto-play, disconnected players are covered, and after 60 s a bot takes the seat. Reloading the page rejoins the same seat (token in localStorage).
- **Chat:** live next to the board, system messages for joins, captures and finishes, 200-character limit, 1 message/second, rendered as plain text.
- **One-device mode:** pass-and-play on a single screen.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

### Load test (16 fake players over real sockets)

```bash
cd server
LUDO_TIMING_SCALE=0.02 PORT=5055 npx tsx src/index.ts        # terminal 1
PLAYERS=16 SERVER=http://localhost:5055 npx tsx test/simulate.ts  # terminal 2
```

`LUDO_TIMING_SCALE` shrinks every server delay so a full game finishes in under a minute. Never set it in production.

## Repo structure
- `shared/src`: rules engine (pure, tested), board geometry, capture styles and the socket contract (`net.ts`).
- `server/src`: Express + Socket.IO. `rooms/Room.ts` holds the game state machine, `RoomManager.ts` the room registry.
- `client/src`: React, Tailwind v4, Zustand, react-three-fiber.
  - `screens/`: Home, Lobby, OnlineGame, LocalGame
  - `game/board3d/`: Tile, Home, Character, CartoonDog, CaptureEffect, HomeCamera, AnimationDirector, World
  - `net/session.ts`: socket events to stores, rejoin after reload
- `docs/NEXT_STEPS.md`: what is left and a ready prompt for continuing with another assistant.

## Technical notes
- npm workspaces link `@ludo-rush/shared` into client and server.
- 3D labels use a bundled font (`client/public/fonts`), so the board never depends on a CDN.
- Rooms live in server memory; run one server instance. Use a host with WebSocket support (free instances can sleep).
- `.env` is ignored by git. Set `VITE_SERVER_URL` in the client and `CLIENT_ORIGIN` on the server when deploying.
