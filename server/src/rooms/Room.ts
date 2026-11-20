import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import {
    DEFAULT_ROOM_OPTIONS,
    ROOM_LIMITS,
    applyMove,
    createArenaGame,
    finalRanking,
    isGameOver,
    resolveRoll,
    type ChatMessage,
    type ClientToServerEvents,
    type GameSettings,
    type GameState,
    type JoinAck,
    type MoveResult,
    type PublicPlayer,
    type RoomOptions,
    type RoomPhase,
    type RoomSnapshot,
    type ServerToClientEvents,
    type TurnInfo,
} from '@ludo-rush/shared';
import { chooseBotMove } from './bot';
import { cleanChat, cleanNickname } from './text';

export type LudoServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** LUDO_TIMING_SCALE=0.02 makes simulations run fast; leave unset in production. */
const scale = Number(process.env.LUDO_TIMING_SCALE ?? '1');
const ms = (n: number) => Math.max(1, Math.round(n * (Number.isFinite(scale) && scale > 0 ? scale : 1)));

export const TIMING = {
    botDelayMs: ms(900),
    singleMoveDelayMs: ms(700),
    passDelayMs: ms(1400),
    graceMs: ms(60_000),
    walkMsPerTile: ms(380),
    runMsPerTile: ms(230),
    sceneBufferMs: ms(500),
    maxSceneMs: ms(4000),
} as const;

interface Member {
    id: string;
    token: string;
    nickname: string;
    socketId: string | null;
    seat: number | null;
    isBot: boolean;
    spectator: boolean;
    lastChatAt: number;
    graceTimer: NodeJS.Timeout | null;
}

type Awaiting = 'ROLL' | 'MOVE' | 'LOCK';

export class Room {
    readonly code: string;
    phase: RoomPhase = 'LOBBY';
    options: RoomOptions = { ...DEFAULT_ROOM_OPTIONS };
    hostId = '';
    private members: Member[] = [];
    private game: GameState | null = null;
    private settings: GameSettings | null = null;
    private awaiting: Awaiting = 'ROLL';
    private validIds: string[] = [];
    private deadline: number | null = null;
    private chat: ChatMessage[] = [];
    private turnTimer: NodeJS.Timeout | null = null;
    private botTimer: NodeJS.Timeout | null = null;
    private lockTimer: NodeJS.Timeout | null = null;
    /** Bumped on every transition so stale timers do nothing. */
    private token = 0;
    lastActive = Date.now();

    constructor(code: string, private readonly io: LudoServer) {
        this.code = code;
    }

    // ---------- membership ----------

    get channel(): string {
        return `room:${this.code}`;
    }

    private players(): Member[] {
        return this.members.filter(m => !m.spectator);
    }

    private byId(id: string): Member | undefined {
        return this.members.find(m => m.id === id);
    }

    memberOfSocket(socketId: string): Member | undefined {
        return this.members.find(m => m.socketId === socketId);
    }

    connectedHumans(): number {
        return this.members.filter(m => m.socketId !== null && !m.isBot).length;
    }

    playerCount(): number {
        return this.players().length;
    }

    join(
        nickname: unknown,
        socketId: string,
        rejoinToken?: string,
        rejoinOnly = false
    ): { member: Member; ack: JoinAck } | { error: string } {
        if (rejoinToken) {
            const existing = this.members.find(m => m.token === rejoinToken);
            if (existing) {
                existing.socketId = socketId;
                existing.isBot = false;
                if (existing.graceTimer) clearTimeout(existing.graceTimer);
                existing.graceTimer = null;
                this.say(`${existing.nickname} is back.`);
                this.touch();
                return { member: existing, ack: this.ackFor(existing) };
            }
        }

        if (rejoinOnly) return { error: 'Your seat is no longer available.' };

        const asPlayer = this.phase === 'LOBBY';

        if (asPlayer && this.playerCount() >= ROOM_LIMITS.maxPlayers) {
            return { error: `Room is full (${ROOM_LIMITS.maxPlayers} players).` };
        }

        const member: Member = {
            id: randomUUID(),
            token: randomBytes(16).toString('hex'),
            nickname: cleanNickname(
                nickname,
                this.members.map(m => m.nickname),
                `Player ${this.members.length + 1}`
            ),
            socketId,
            seat: null,
            isBot: false,
            spectator: !asPlayer,
            lastChatAt: 0,
            graceTimer: null,
        };

        this.members.push(member);
        if (!this.hostId) this.hostId = member.id;

        this.say(
            asPlayer
                ? `${member.nickname} joined the room.`
                : `${member.nickname} is watching.`
        );
        this.touch();
        return { member, ack: this.ackFor(member) };
    }

    private ackFor(member: Member): JoinAck {
        return {
            ok: true,
            code: this.code,
            playerId: member.id,
            rejoinToken: member.token,
            spectator: member.spectator,
        };
    }

    /** Socket dropped: keep the seat, auto-play, and bot-ify after the grace period. */
    disconnect(socketId: string): void {
        const member = this.memberOfSocket(socketId);
        if (!member) return;
        member.socketId = null;

        if (this.phase === 'LOBBY' || member.spectator) {
            this.removeMember(member);
            return;
        }

        this.say(`${member.nickname} disconnected. Auto-play covers their turns.`);
        member.graceTimer = setTimeout(() => {
            member.isBot = true;
            member.graceTimer = null;
            this.say(`${member.nickname} left; a bot took over.`);
            this.broadcastState();
            this.scheduleBotIfNeeded();
        }, TIMING.graceMs);

        this.reassignHost();
        this.touch();
        this.broadcastState();
        this.scheduleBotIfNeeded();
    }

    leave(memberId: string): void {
        const member = this.byId(memberId);
        if (!member) return;

        if (this.phase === 'PLAYING' && !member.spectator) {
            member.socketId = null;
            member.isBot = true;
            if (member.graceTimer) clearTimeout(member.graceTimer);
            member.graceTimer = null;
            this.say(`${member.nickname} left; a bot took over.`);
            this.reassignHost();
            this.broadcastState();
            this.scheduleBotIfNeeded();
            return;
        }

        this.removeMember(member);
    }

    private removeMember(member: Member): void {
        if (member.graceTimer) clearTimeout(member.graceTimer);
        this.members = this.members.filter(m => m !== member);
        this.say(`${member.nickname} left the room.`);
        this.reassignHost();
        this.touch();
        this.broadcastState();
    }

    private reassignHost(): void {
        const host = this.byId(this.hostId);
        if (host && host.socketId !== null && !host.isBot) return;
        const next = this.members.find(m => m.socketId !== null && !m.isBot);
        if (next) this.hostId = next.id;
    }

    // ---------- snapshots and chat ----------

    snapshot(): RoomSnapshot {
        const players: PublicPlayer[] = this.players().map(m => ({
            id: m.id,
            nickname: m.nickname,
            seat: m.seat,
            connected: m.socketId !== null,
            isBot: m.isBot,
            isHost: m.id === this.hostId,
        }));

        return {
            code: this.code,
            phase: this.phase,
            options: this.options,
            hostId: this.hostId,
            players,
            spectators: this.members.filter(m => m.spectator).length,
            game: this.game,
            turn: this.turnInfo(),
            chat: this.chat,
        };
    }

    private turnInfo(): TurnInfo | null {
        if (!this.game || this.phase !== 'PLAYING') return null;
        return {
            seat: this.game.turnSeat,
            deadline: this.deadline,
            dice: this.game.dice,
            validPieceIds: this.validIds,
        };
    }

    broadcastState(): void {
        this.io.to(this.channel).emit('room:state', this.snapshot());
    }

    emitStateTo(socketId: string): void {
        this.io.to(socketId).emit('room:state', this.snapshot());
    }

    private push(message: ChatMessage): void {
        this.chat.push(message);
        if (this.chat.length > ROOM_LIMITS.chatHistory) {
            this.chat.splice(0, this.chat.length - ROOM_LIMITS.chatHistory);
        }
        this.io.to(this.channel).emit('chat:message', message);
    }

    say(text: string): void {
        this.push({ id: randomUUID(), type: 'system', text, ts: Date.now() });
    }

    sendChat(member: Member, raw: unknown): void {
        const text = cleanChat(raw);
        const now = Date.now();
        if (!text || now - member.lastChatAt < 1000) return;
        member.lastChatAt = now;
        this.push({
            id: randomUUID(),
            type: 'user',
            nickname: member.nickname,
            seat: member.seat,
            text,
            ts: now,
        });
        this.touch();
    }

    private touch(): void {
        this.lastActive = Date.now();
    }

    // ---------- lobby ----------

    setOptions(member: Member, partial: Partial<RoomOptions>): string | null {
        if (member.id !== this.hostId) return 'Only the host can change settings.';
        if (this.phase !== 'LOBBY') return 'Settings are locked during a game.';

        const next = { ...this.options };
        if (partial.piecesPerPlayer !== undefined) {
            if (![1, 2, 4].includes(partial.piecesPerPlayer)) return 'Pieces must be 1, 2 or 4.';
            next.piecesPerPlayer = partial.piecesPerPlayer;
        }
        if (partial.difficulty !== undefined) {
            if (!['EASY', 'MEDIUM', 'HARD'].includes(partial.difficulty)) return 'Unknown difficulty.';
            next.difficulty = partial.difficulty;
        }
        if (partial.turnSeconds !== undefined) {
            const s = Math.round(Number(partial.turnSeconds));
            if (!Number.isFinite(s)) return 'Invalid turn time.';
            next.turnSeconds = Math.min(
                ROOM_LIMITS.maxTurnSeconds,
                Math.max(ROOM_LIMITS.minTurnSeconds, s)
            );
        }
        this.options = next;
        this.broadcastState();
        return null;
    }

    start(member: Member): string | null {
        if (member.id !== this.hostId) return 'Only the host can start the game.';
        if (this.phase !== 'LOBBY') return 'The game already started.';

        const players = this.players();
        if (players.length < ROOM_LIMITS.minPlayersToStart) {
            return `Need at least ${ROOM_LIMITS.minPlayersToStart} players.`;
        }

        // Fisher-Yates with crypto randomness: seat order is random.
        const order = [...players];
        for (let i = order.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [order[i], order[j]] = [order[j]!, order[i]!];
        }
        const arena = createArenaGame(order.length, this.options.piecesPerPlayer, this.options.difficulty);
        order.forEach((m, i) => {
            m.seat = arena.seats[i]!;
        });

        this.settings = arena.settings;
        this.game = arena.game;
        this.phase = 'PLAYING';
        this.say(`Game started with ${order.length} players. ${order[0]!.nickname} rolls first.`);
        this.broadcastState();
        this.beginTurn();
        return null;
    }

    rematch(member: Member): string | null {
        if (member.id !== this.hostId) return 'Only the host can restart.';
        if (this.phase !== 'FINISHED') return 'The game is not finished.';
        this.clearTimers();
        this.game = null;
        this.settings = null;
        this.validIds = [];
        this.deadline = null;
        this.phase = 'LOBBY';
        this.members = this.members.filter(m => m.socketId !== null && !m.isBot);
        for (const m of this.members) {
            m.seat = null;
            m.spectator = false;
        }
        this.say('Back in the lobby. Ready for another round?');
        this.broadcastState();
        return null;
    }

    // ---------- game flow ----------

    private clearTimers(): void {
        this.token++;
        for (const t of [this.turnTimer, this.botTimer, this.lockTimer]) {
            if (t) clearTimeout(t);
        }
        this.turnTimer = this.botTimer = this.lockTimer = null;
    }

    private currentMember(): Member | undefined {
        if (!this.game) return undefined;
        return this.players().find(m => m.seat === this.game!.turnSeat);
    }

    private isAuto(member: Member | undefined): boolean {
        return !member || member.isBot || member.socketId === null;
    }

    private beginTurn(): void {
        if (!this.game) return;
        this.clearTimers();
        this.awaiting = 'ROLL';
        this.validIds = [];
        this.armTurnTimer();
        this.io.to(this.channel).emit('game:turn', this.turnInfo()!);
        this.scheduleBotIfNeeded();
    }

    private armTurnTimer(): void {
        const stamp = this.token;
        const ms = this.options.turnSeconds * 1000;
        this.deadline = Date.now() + ms;
        if (this.turnTimer) clearTimeout(this.turnTimer);
        this.turnTimer = setTimeout(() => {
            if (stamp !== this.token) return;
            this.autoPlay();
        }, ms);
    }

    /** Auto-play after a timeout, or immediately for bots and disconnected players. */
    private scheduleBotIfNeeded(): void {
        if (this.phase !== 'PLAYING' || this.awaiting === 'LOCK') return;
        if (!this.isAuto(this.currentMember())) return;
        if (this.botTimer) clearTimeout(this.botTimer);
        const stamp = this.token;
        this.botTimer = setTimeout(() => {
            if (stamp !== this.token) return;
            this.autoPlay();
        }, TIMING.botDelayMs);
    }

    private autoPlay(): void {
        if (this.phase !== 'PLAYING' || !this.game) return;
        if (this.awaiting === 'ROLL') this.doRoll();
        else if (this.awaiting === 'MOVE') this.doMove(this.pickAuto());
    }

    private pickAuto(): string {
        return chooseBotMove(this.game!, this.settings!, this.validIds);
    }

    roll(member: Member): string | null {
        if (this.phase !== 'PLAYING' || !this.game) return 'No game is running.';
        if (member.seat !== this.game.turnSeat) return 'It is not your turn.';
        if (this.awaiting !== 'ROLL') return 'Roll already used.';
        this.doRoll();
        return null;
    }

    move(member: Member, pieceId: unknown): string | null {
        if (this.phase !== 'PLAYING' || !this.game) return 'No game is running.';
        if (member.seat !== this.game.turnSeat) return 'It is not your turn.';
        if (this.awaiting !== 'MOVE') return 'Roll first.';
        if (typeof pieceId !== 'string' || !this.validIds.includes(pieceId)) {
            return 'That piece cannot move.';
        }
        this.doMove(pieceId);
        return null;
    }

    private doRoll(): void {
        if (!this.game || !this.settings) return;
        this.clearTimers();

        const seat = this.game.turnSeat;
        const value = randomInt(1, 7);
        const result = resolveRoll(this.game, value, this.settings);
        this.game = result.game;
        this.validIds = result.validPieceIds;
        this.touch();

        this.io.to(this.channel).emit('game:rolled', {
            seat,
            value,
            validPieceIds: result.validPieceIds,
            cancelled: result.cancelled,
            nextSeat: result.nextSeat,
            game: result.game,
        });

        if (result.validPieceIds.length === 0) {
            this.lockThenAdvance(TIMING.passDelayMs);
            return;
        }

        this.awaiting = 'MOVE';

        if (result.validPieceIds.length === 1) {
            // Only one legal move: no need to make everyone wait for a click.
            const only = result.validPieceIds[0]!;
            const stamp = this.token;
            this.botTimer = setTimeout(() => {
                if (stamp !== this.token) return;
                this.doMove(only);
            }, TIMING.singleMoveDelayMs);
            return;
        }

        this.armTurnTimer();
        this.io.to(this.channel).emit('game:turn', this.turnInfo()!);
        this.scheduleBotIfNeeded();
    }

    private doMove(pieceId: string): void {
        if (!this.game || !this.settings) return;
        this.clearTimers();

        let move: MoveResult;
        try {
            move = applyMove(this.game, pieceId, this.settings, randomInt);
        } catch {
            this.beginTurn();
            return;
        }

        this.game = move.game;
        this.validIds = [];
        this.touch();

        const travel = move.path.length * (move.run ? TIMING.runMsPerTile : TIMING.walkMsPerTile);
        const scenes = move.captures.reduce((sum, c) => sum + ms(c.lockMs), 0);
        const lockMs = travel + Math.min(scenes, TIMING.maxSceneMs) + TIMING.sceneBufferMs;

        this.io.to(this.channel).emit('game:moved', { move, lockMs });

        for (const capture of move.captures) {
            const victimSeat = Number(capture.victimId.split('-')[0]!.slice(1));
            const attackerSeat = Number(capture.attackerId.split('-')[0]!.slice(1));
            const victim = this.players().find(m => m.seat === victimSeat);
            const attacker = this.players().find(m => m.seat === attackerSeat);
            if (victim && attacker) {
                const verb =
                    capture.style === 'GUN'
                        ? 'shot'
                        : capture.style === 'SLAP'
                            ? 'slapped'
                            : 'set the dog on';
                this.say(`${attacker.nickname} ${verb} ${victim.nickname}!`);
            }
        }

        if (move.playerFinished) {
            const finished = this.players().find(m => m.seat === move.game.ranking.at(-1));
            if (finished) {
                this.say(`${finished.nickname} finished #${move.game.ranking.length}!`);
            }
        }

        this.lockThenAdvance(lockMs);
    }

    private lockThenAdvance(ms: number): void {
        this.awaiting = 'LOCK';
        this.deadline = null;
        const stamp = this.token;
        this.lockTimer = setTimeout(() => {
            if (stamp !== this.token) return;
            this.advance();
        }, ms);
    }

    private advance(): void {
        if (!this.game) return;

        if (isGameOver(this.game)) {
            this.finish();
            return;
        }

        this.beginTurn();
    }

    private finish(): void {
        if (!this.game) return;
        this.clearTimers();

        const ranking = finalRanking(this.game);
        this.game = { ...this.game, ranking };
        this.phase = 'FINISHED';
        this.deadline = null;

        const winner = this.players().find(m => m.seat === ranking[0]);
        this.say(`${winner?.nickname ?? 'Someone'} wins the game!`);
        this.io.to(this.channel).emit('game:ended', { ranking });
        this.broadcastState();
    }

    destroy(): void {
        this.clearTimers();
        for (const m of this.members) {
            if (m.graceTimer) clearTimeout(m.graceTimer);
        }
    }
}
