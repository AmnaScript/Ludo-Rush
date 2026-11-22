import { DIFFICULTY_INFO, type Difficulty } from '@ludo-rush/shared';

const ORDER: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const ACCENT: Record<Difficulty, string> = { EASY: 'var(--green)', MEDIUM: 'var(--brass)', HARD: 'var(--red)' };
const FACE: Record<Difficulty, string> = { EASY: '🙂', MEDIUM: '🎲', HARD: '😈' };

/** Three rule presets side by side; each card lists its rules in plain words. */
export function DifficultyPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,13.5rem),1fr))]" role="radiogroup" aria-label="Difficulty">
      {ORDER.map((d) => {
        const info = DIFFICULTY_INFO[d];
        const on = value === d;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(d)}
            style={{ borderColor: on ? ACCENT[d] : 'transparent' }}
            className={`flex min-w-0 flex-col break-words rounded-2xl border-[3px] p-3.5 text-left transition disabled:cursor-not-allowed ${
              on ? 'bg-[var(--paper-2)] shadow-[0_5px_0_var(--ink)]' : 'bg-[#211812] opacity-75 hover:opacity-100'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: 'rgb(255 255 255 / 0.07)' }}>
                {FACE[d]}
              </span>
              <span className="min-w-0 truncate font-title text-xl" style={{ color: on ? ACCENT[d] : undefined }}>{info.label}</span>
              {on && <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brass)] text-sm font-black text-[#1a0f08]" aria-label="Selected">✓</span>}
            </span>
            <span className="mt-1.5 text-sm font-bold text-[var(--ink-soft)]">{info.tagline}</span>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] font-bold leading-snug">
              {info.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
