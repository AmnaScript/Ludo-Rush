import { DIFFICULTY_INFO, type Difficulty } from '@ludo-rush/shared';

const ORDER: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const BADGE: Record<Difficulty, string> = { EASY: 'var(--green)', MEDIUM: 'var(--yellow)', HARD: 'var(--red)' };

/** Three big cards, each listing its rules in plain words. */
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
    <div className="space-y-2.5" role="radiogroup" aria-label="Difficulty">
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
            className={`block w-full rounded-2xl border-[3px] border-[var(--ink)] p-3 text-left transition ${on ? 'bg-[#fffaf0] shadow-[0_4px_0_var(--ink)]' : 'bg-[var(--paper-2)] opacity-80 hover:opacity-100'} disabled:cursor-not-allowed`}
          >
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border-[3px] border-[var(--ink)]" style={{ background: on ? BADGE[d] : 'transparent' }} />
              <span className="font-title text-xl">{info.label}</span>
              <span className="text-sm font-bold text-[var(--ink-soft)]">{info.tagline}</span>
            </span>
            {on && (
              <ul className="mt-2 list-disc space-y-0.5 pl-9 text-sm font-bold">
                {info.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
