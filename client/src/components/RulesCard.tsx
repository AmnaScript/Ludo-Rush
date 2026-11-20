import { DIFFICULTY_INFO, type Difficulty } from '@ludo-rush/shared';

/** Rules for the current difficulty plus the basics that never change. */
export function RulesCard({ difficulty }: { difficulty: Difficulty }) {
  const info = DIFFICULTY_INFO[difficulty];
  return (
    <details className="panel p-4">
      <summary className="panel-title cursor-pointer">Rules ({info.label})</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-bold">
        {info.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
        <li>Move clockwise. A 6 or a capture gives you another roll.</li>
        <li>Landing on an opponent sends them back to base.</li>
        <li>Get all your characters home first.</li>
      </ul>
    </details>
  );
}
