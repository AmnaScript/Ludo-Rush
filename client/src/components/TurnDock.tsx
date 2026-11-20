import { RollingDice } from './RollingDice';

/** The one place a player looks: whose turn, what to do, and the big ROLL button. */
export function TurnDock({
  color,
  who,
  hint,
  warn,
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
  warn?: string | null;
  dice: number | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
  yourTurn?: boolean;
  secondsLeft?: number | null;
}) {
  return (
    <div className="panel flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4" style={{ borderColor: 'var(--ink)' }}>
      <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center">
        <RollingDice value={dice} rolling={rolling} size={52} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-title text-lg leading-tight">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--ink)]" style={{ backgroundColor: color }} />
          <span className="truncate">{who}</span>
          {secondsLeft != null && yourTurn && <span className="ml-auto shrink-0 text-sm text-[var(--ink-soft)]">{secondsLeft}s</span>}
        </p>
        <p className="text-sm font-extrabold leading-snug text-[var(--ink-soft)]">{hint}</p>
        {warn && <p className="mt-0.5 text-xs font-extrabold leading-snug text-[var(--red)]">{warn}</p>}
      </div>

      <button
        type="button"
        disabled={!canRoll}
        onClick={onRoll}
        className={`btn shrink-0 !px-5 !py-3 text-xl ${canRoll ? 'btn-red pulse-ring' : ''}`}
      >
        {canRoll ? 'ROLL' : yourTurn ? '…' : 'WAIT'}
      </button>
    </div>
  );
}
