import * as THREE from 'three';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { type Board3DHandle, type Props, type ActorData, type MoveJob, type FXState, type CameraActions } from './board3d/types';
import { vec } from './board3d/helpers';
import { World } from './board3d/World';

export type { Board3DHandle } from './board3d/types';

export const Board3D = forwardRef<
    Board3DHandle,
    Props
>(function Board3D(props, ref) {
    const jobRef = useRef<MoveJob | null>(null);

    const actors = useRef(
        new Map<string, ActorData>()
    );

    const dogRef = useRef<THREE.Group | null>(null);

    const cameraActions =
        useRef<CameraActions['current']>(null);

    const [effect, setEffect] =
        useState<FXState | null>(null);

    useImperativeHandle(
        ref,
        () => ({
            resetView: () =>
                cameraActions.current?.resetView(),

            playMove: move =>
                new Promise<void>(resolve => {
                    const attacker = actors.current.get(
                        move.pieceId
                    );

                    if (!attacker || jobRef.current) {
                        resolve();
                        return;
                    }

                    jobRef.current = {
                        move,
                        resolve,
                        stage: 'travel',
                        index: 0,
                        time: 0,
                        from: vec(attacker.root.position),
                        captureIndex: 0,
                        captureStarted: false,
                        victimFrom: null,
                    };
                }),
        }),
        []
    );

    useEffect(() => {
        return () => {
            jobRef.current?.resolve();
            jobRef.current = null;
            document.body.style.cursor = 'auto';
        };
    }, []);

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#150e0a]">
            <Canvas
                shadows
                orthographic
                dpr={[1, 1.5]}
                camera={{
                    zoom: 40,
                    position: [0, 60, 0],
                    near: 1,
                    far: 200,
                }}
                gl={{
                    antialias: true,
                    powerPreference: 'high-performance',
                }}
            >
                <World
                    {...props}
                    jobRef={jobRef}
                    actors={actors}
                    dogRef={dogRef}
                    cameraActions={cameraActions}
                    effect={effect}
                    setEffect={setEffect}
                />
            </Canvas>

            {effect && (() => {
                const name = (seat: number) =>
                    props.seatLabels?.[seat] ?? `Player ${seat + 1}`;
                const A = name(effect.attackerSeat);
                const V = name(effect.victimSeat);
                const [emoji, headline, detail] =
                    effect.style === 'PENALTY'
                        ? ['⚠️', `${A} skipped a capture!`, 'Hard rule: that character goes back to base']
                        : effect.style === 'SLAP'
                        ? ['👋', `${A} slapped ${V}!`, `${V} runs back home crying`]
                        : effect.style === 'DOG'
                            ? ['🐶', `${A} whistled for the dog!`, `${V} gets chased home and the door is locked`]
                            : ['🔫', `${A} shot ${V}!`, `${V} goes back to base`];
                return (
                    <div
                        aria-live="polite"
                        className="pointer-events-none absolute left-1/2 top-[78px] z-10 w-[min(92%,520px)] -translate-x-1/2 rounded-2xl border-4 border-white bg-[#ffcc32] px-5 py-3 text-center shadow-2xl"
                    >
                        <p className="text-xl font-black text-[#253747] sm:text-2xl">
                            {emoji} {headline}
                        </p>
                        <p className="text-sm font-bold text-[#6b4a00]">{detail}</p>
                    </div>
                );
            })()}
        </div>
    );
});
