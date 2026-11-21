import { Bot, WifiOff } from 'lucide-react';

export type StandingRow = {
  key: string;
  name: string;
  color: string;
  home: number;
  total: number;
  rank?: number;
  active: boolean;
  you?: boolean;
  bot?: boolean;
  offline?: boolean;
};

/** Match standings: who is playing now and how many characters each player has home. */
export function Standings({ rows, turnsNote }: { rows: StandingRow[]; turnsNote?: string }) {
  return (
    <section className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="panel-title">Standings</p>
        {turnsNote && <span className="badge">{turnsNote}</span>}
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2"
            style={{
              background: r.active ? 'rgb(255 184 0 / 0.14)' : 'rgb(255 255 255 / 0.04)',
              boxShadow: r.active ? 'inset 0 0 0 2px var(--brass)' : undefined,
            }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-title text-lg text-[#1a0f08]"
              style={{ backgroundColor: r.color }}
            >
              {r.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate font-extrabold leading-tight">
              {r.name}
              {r.you && <span className="text-[var(--ink-soft)]"> (you)</span>}
              {r.bot && <Bot size={13} className="ml-1.5 inline" aria-label="Bot" />}
              {r.offline && <WifiOff size={13} className="ml-1.5 inline text-[var(--red)]" aria-label="Offline" />}
            </span>
            <span className="shrink-0 text-right leading-tight">
              <span className="font-title text-xl">{r.rank ? `#${r.rank}` : `${r.home}/${r.total}`}</span>
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">{r.rank ? 'Finished' : 'In home'}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
