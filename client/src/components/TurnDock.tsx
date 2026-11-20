import { RollingDice } from './RollingDice';

/** Whose turn it is, what to do, and the dice. The dice itself is the roll button. */
export function TurnDock({
  color,
  who,
  hint,
  dice,
  rolling,
  canRoll,
  onRoll,
  yourTurn = true,
  secondsLeft,
}: {
  color: string;
  who: string;
  hint: string;
  dice: number | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  yourTurn?: boolean;
  secondsLeft?: number | null;
}) {
  return (
    <div className="panel flex items-center gap-4 px-4 py-2.5">
      <button
        type="button"
        disabled={!canRoll}
        onClick={onRoll}
        aria-label="Roll the dice"
        className={`flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-2xl border-[3px] border-[var(--ink)] transition ${
          canRoll ? 'pulse-ring cursor-pointer bg-[var(--yellow)] hover:scale-105' : 'bg-[var(--paper-2)]'
        } disabled:cursor-default`}
      >
        <RollingDice value={dice} rolling={rolling} size={52} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-title text-xl leading-tight">
          <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--ink)]" style={{ backgroundColor: color }} />
          <span className="truncate">{who}</span>
          {secondsLeft != null && yourTurn && <span className="ml-auto shrink-0 text-sm text-[var(--ink-soft)]">{secondsLeft}s</span>}
        </p>
        <p className="text-sm font-extrabold leading-snug text-[var(--ink-soft)]">{hint}</p>
      </div>
    </div>
  );
}
