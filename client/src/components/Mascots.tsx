/** Hand-drawn SVG characters used on the title screen (same look as the 3D pieces). */
const SKIN = ['#f1c49b', '#d9a070', '#a96f48', '#f6d6b8'];
const HAIR = ['#2b1a12', '#7a3b1d', '#e0a526', '#1c1c24'];

export function Mascot({ color, i, className = '' }: { color: string; i: number; className?: string }) {
  const skin = SKIN[i % SKIN.length];
  const hair = HAIR[i % HAIR.length];
  return (
    <svg viewBox="0 0 80 110" className={className} aria-hidden>
      <g stroke="#2b1a12" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="40" cy="104" rx="26" ry="5" fill="#000" opacity="0.25" stroke="none" />
        <rect x="24" y="70" width="12" height="28" rx="6" fill="#3b2a6b" />
        <rect x="44" y="70" width="12" height="28" rx="6" fill="#3b2a6b" />
        <rect x="14" y="40" width="52" height="40" rx="18" fill={color} />
        <rect x="6" y="46" width="14" height="26" rx="7" fill={color} />
        <rect x="60" y="46" width="14" height="26" rx="7" fill={color} />
        <circle cx="40" cy="28" r="22" fill={skin} />
        <path d="M18 26 C18 6 62 6 62 26 C54 18 26 18 18 26 Z" fill={hair} />
        <circle cx="31" cy="30" r="3" fill="#2b1a12" stroke="none" />
        <circle cx="49" cy="30" r="3" fill="#2b1a12" stroke="none" />
        <path d="M33 39 Q40 45 47 39" fill="none" strokeWidth="3" />
      </g>
    </svg>
  );
}

export function DiceIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <g stroke="#2b1a12" strokeWidth="4" strokeLinejoin="round">
        <rect x="8" y="8" width="64" height="64" rx="14" fill="#fffaf0" />
      </g>
      {[[26, 26], [54, 26], [40, 40], [26, 54], [54, 54]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#d93a2f" />
      ))}
    </svg>
  );
}
