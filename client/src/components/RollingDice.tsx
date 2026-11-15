import { useEffect, useRef, useState } from 'react';
import { play } from '../audio/sfx';

/** Rotation (x, y in degrees) that brings each face towards the viewer. */
const SHOW: Record<number, [number, number]> = {
  1: [0, 0],
  2: [0, -90],
  3: [-90, 0],
  4: [90, 0],
  5: [0, 90],
  6: [0, 180],
};

const FACES: { value: number; transform: string }[] = [
  { value: 1, transform: 'translateZ(var(--h))' },
  { value: 2, transform: 'rotateY(90deg) translateZ(var(--h))' },
  { value: 3, transform: 'rotateX(90deg) translateZ(var(--h))' },
  { value: 4, transform: 'rotateX(-90deg) translateZ(var(--h))' },
  { value: 5, transform: 'rotateY(-90deg) translateZ(var(--h))' },
  { value: 6, transform: 'rotateY(180deg) translateZ(var(--h))' },
];

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** How long the dice tumbles before the number is revealed. */
export const ROLL_MS = 1100;

/**
 * A real 3D cube: it tumbles while `rolling` is true, then spins down and
 * lands with `value` facing the viewer.
 */
export function RollingDice({
  value,
  rolling,
  size = 88,
}: {
  value: number | null;
  rolling: boolean;
  size?: number;
}) {
  const current = useRef({ x: -20, y: 30 });
  const frame = useRef(0);
  const [angles, setAngles] = useState({ x: -20, y: 30 });
  const [settling, setSettling] = useState(false);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (!rolling) return;
    play('roll');
    setSettling(false);
    let last = performance.now();
    const started = last;

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      current.current = {
        x: current.current.x + dt * 640,
        y: current.current.y + dt * 790,
      };
      setAngles({ ...current.current });
      setLift(Math.abs(Math.sin((now - started) / 170)) * 18);
      frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame.current);
      setLift(0);
    };
  }, [rolling]);

  useEffect(() => {
    if (rolling || !value) return;
    const landTimer = window.setTimeout(() => play('land'), 700);
    const [rx, ry] = SHOW[value]!;
    // Always travel forward by two extra turns so it visibly spins down.
    const x = Math.ceil(current.current.x / 360) * 360 + 720 + rx;
    const y = Math.ceil(current.current.y / 360) * 360 + 720 + ry;
    current.current = { x, y };
    setSettling(true);
    setAngles({ x, y });
    return () => window.clearTimeout(landTimer);
  }, [rolling, value]);

  const half = size / 2;

  return (
    <div
      role="img"
      aria-label={value ? `Dice shows ${value}` : 'Dice'}
      style={{
        width: size,
        height: size,
        perspective: size * 6,
        ['--h' as string]: `${half}px`,
      }}
      className="relative mx-auto"
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: 'preserve-3d',
          transform: `translateY(${-lift}px) rotateX(-16deg) rotateY(16deg)`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${angles.x}deg) rotateY(${angles.y}deg)`,
            transition: settling
              ? 'transform 650ms cubic-bezier(0.15, 0.75, 0.25, 1)'
              : 'none',
          }}
        >
          {FACES.map((face) => (
            <div
              key={face.value}
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-[7%] rounded-[18%] border border-stone-300 p-[14%]"
              style={{
                transform: face.transform,
                backfaceVisibility: 'hidden',
                background: 'linear-gradient(145deg, #ffffff, #efe6d6)',
                boxShadow: 'inset 0 0 12px rgba(0,0,0,0.12)',
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className="m-auto rounded-full"
                  style={{
                    width: '78%',
                    height: '78%',
                    background: PIPS[face.value]!.includes(i)
                      ? face.value === 1
                        ? '#e0344f'
                        : '#2a3441'
                      : 'transparent',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute left-1/2 rounded-full bg-black/20 blur-sm"
        style={{
          bottom: -size * 0.16,
          width: size * (0.8 - lift / 120),
          height: size * 0.14,
          transform: 'translateX(-50%)',
        }}
      />
    </div>
  );
}
