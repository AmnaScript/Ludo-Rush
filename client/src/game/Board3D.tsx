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
            zoomIn: () =>
                cameraActions.current?.zoomIn(),

            zoomOut: () =>
                cameraActions.current?.zoomOut(),

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
        <div className="relative h-[490px] w-full overflow-hidden rounded-2xl bg-[#69cfff] sm:h-[630px] lg:h-[740px]">
            <Canvas
                shadows
                dpr={[1, 1.5]}
                camera={{
                    fov: 42,
                    position: [16, 19, 22],
                    near: 0.1,
                    far: 250,
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

            {effect && (
                <div
                    aria-live="polite"
                    className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2 rounded-2xl border-4 border-white bg-[#ffcc32] px-6 py-3 text-2xl font-black text-[#253747] shadow-2xl"
                >
                    {effect.style === 'SLAP'
                        ? '💥 SLAP!'
                        : effect.style === 'DOG'
                            ? '🐶 DOG CHASE!'
                            : '💥 CARTOON SHOT!'}
                </div>
            )}

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl bg-white/85 px-3 py-2 text-xs font-semibold text-[#36546a]">
                Drag to rotate · Scroll to zoom
            </div>
        </div>
    );
});
