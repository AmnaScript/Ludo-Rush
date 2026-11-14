const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function DiceFace({ value, rolling }: { value: number | null; rolling?: boolean }) {
  const pips = value ? PIPS[value] ?? [] : [];
  return (
    <div
      aria-label={value ? `Dice shows ${value}` : 'Dice'}
      className={`grid h-24 w-24 grid-cols-3 grid-rows-3 gap-1.5 rounded-3xl border-4 border-amber-400 bg-[#26475a] p-3 shadow-lg ${rolling ? 'animate-pulse' : ''}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`m-auto h-4 w-4 rounded-full ${pips.includes(i) ? 'bg-white' : 'bg-transparent'}`}
        />
      ))}
    </div>
  );
}
