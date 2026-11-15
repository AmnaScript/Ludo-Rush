/** Short, always-available summary of the classic Ludo rules the engine enforces. */
export function RulesCard() {
  return (
    <details className="rounded-3xl bg-white p-4 shadow-sm">
      <summary className="cursor-pointer font-black">How to play (rules)</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>Roll a <b>6</b> to bring a character out of its base onto your start tile.</li>
        <li>Move one character by the dice number, clockwise. If only one move is possible it is played for you.</li>
        <li>A <b>6</b> gives an extra roll — but three 6s in a row cancel the turn.</li>
        <li>Landing on an opponent sends them back to base (shoot, slap or dog!) and gives you an extra roll.</li>
        <li>Start tiles and ⭐ tiles are safe. Two or more of your characters on one tile form a squad that cannot be captured.</li>
        <li>After a full lap you turn into your coloured home lane. Roll the <b>exact</b> number to reach the centre; reaching it gives an extra roll.</li>
        <li>Get all your characters home first. The game continues until everyone is ranked.</li>
        <li>No move possible? The turn passes automatically.</li>
      </ul>
    </details>
  );
}
