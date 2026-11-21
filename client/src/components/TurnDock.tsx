import { RollingDice } from './RollingDice';

/** Whose turn it is and the dice. The dice itself is the roll button. No instructions: just the dice. */
export function TurnDock({
  color,
  who,
  dice,
  rolling,
  canRoll,
  onRoll,
  yourTurn = true,
  secondsLeft,
  totalSeconds,
}: {
  color: string;
  who: string;
  dice: number | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  yourTurn?: boolean;
  secondsLeft?: number | null;
  totalSeconds?: number;
}) {
  const showTimer = secondsLeft != null && yourTurn;
  const pct = showTimer && totalSeconds ? Math.max(0, Math.min(100, (secondsLeft! / totalSeconds) * 100)) : 0;
  return (
    <div className="panel flex items-center gap-4 px-4 py-3" style={{ borderColor: canRoll ? 'var(--brass)' : undefined }}>
      <button
        type="button"
        disabled={!canRoll}
        onClick={onRoll}
        aria-label="Roll the dice"
        className={`flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-2xl transition ${
          canRoll ? 'pulse-ring cursor-pointer bg-[var(--brass)] hover:scale-105' : 'bg-[var(--paper-2)]'
        } disabled:cursor-default`}
      >
        <RollingDice value={dice} rolling={rolling} size={52} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-title text-xl uppercase leading-tight">
          <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
          <span className="truncate">{who}</span>
          {showTimer && <span className="ml-auto shrink-0 text-sm text-[var(--ink-soft)]">{secondsLeft}s</span>}
        </p>
        {showTimer && totalSeconds ? (
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full bg-[var(--brass)] transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
