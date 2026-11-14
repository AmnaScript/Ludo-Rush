# Next steps

## Done
- Phase 0 setup, Phase 1 rules engine (48 tests), Phase 2/3 board and local game, Phase 3.5 3D arena with capture scenes.
- Phase 4 rooms and lobby, Phase 5 server-authoritative sync with timers, bots and reconnect, Phase 7 chat.
- Cleanup: Board3D split into `client/src/game/board3d/*`, dead Phaser code removed, bundled font, billboard labels, camera fit by aspect ratio, distinct colours for large rooms.

## Still open (in priority order)
1. **Look and feel pass** (needs the owner's taste): character variety (hair, skin, accessories), clearer track on big boards, nicer lobby and home screens, sounds (dice, steps, gun, slap, bark, door lock).
2. **Mobile polish:** chat as a slide-up drawer with unread badge, pinch zoom check on real phones, bigger tap targets for pieces.
3. **Room features:** host can mute or kick, emoji reactions floating above bases, per-style capture odds in the lobby, reduced-motion setting.
4. **Server tests:** vitest tests for `Room` (turn flow, timeout auto-play, reconnect, host handoff) next to the existing rules tests; run `test/simulate.ts` in CI.
5. **Bundle size:** the client chunk is large (three.js); lazy-load the board and add `manualChunks`.
6. **Deploy:** client on Netlify, server on Render or Railway. Set `VITE_SERVER_URL` and `CLIENT_ORIGIN`, show a "waking up the server" message for sleeping free instances.

## Prompt to continue with another assistant

> I am building "Ludo Rush", a multiplayer 3D Ludo web game (React + Vite + react-three-fiber client, Node + Express + Socket.IO server, shared TypeScript rules engine). Read README.md and docs/NEXT_STEPS.md first, then the project spec PDF I attach.
> Rooms, lobby, server-authoritative turns, bots, reconnect and chat already work and are tested (`npm test`, and `server/test/simulate.ts` plays a full 16-player game).
> Work on ONE item from "Still open" at a time, starting with item 2 (mobile polish). Write complete files with their paths, no exercises for me. Keep the shared rules engine pure, never trust the client, and keep files small. After each item run `npm run typecheck && npm run lint && npm test && npm run build`, and end with only a commit message (I commit from the VS Code interface).
