import * as THREE from 'three';
import { type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { type GameState } from '@ludo-rush/shared';
import { cellPosition, type BoardLayout, type Vec3 } from '../boardLayout';
import { type CaptureStyle, type MoveJob, type FXState, type ActorRegistry } from './types';
import { vec, place, moveBetween, faceToward, smooth } from './helpers';

export function AnimationDirector({
    game,
    layout,
    jobRef,
    actors,
    dogRef,
    setEffect,
}: {
    game: GameState;
    layout: BoardLayout;
    jobRef: MutableRefObject<MoveJob | null>;
    actors: ActorRegistry;
    dogRef: MutableRefObject<THREE.Group | null>;
    setEffect: (effect: FXState | null) => void;
}) {
    useFrame((_, deltaRaw) => {
        const job = jobRef.current;
        if (!job) return;

        const delta = Math.min(deltaRaw, 0.06);
        const attacker = actors.current.get(job.move.pieceId);

        if (!attacker) {
            jobRef.current = null;
            job.resolve();
            return;
        }

        if (job.stage === 'travel') {
            if (job.index >= job.move.path.length) {
                attacker.action = 'idle';
                job.stage = job.move.captures.length
                    ? 'capture'
                    : 'finish';
                job.time = 0;
                return;
            }

            const target = cellPosition(
                job.move.path[job.index],
                layout
            );

            const duration = job.move.run ? 0.18 : 0.28;

            job.time += delta;

            const t = smooth(job.time / duration);

            attacker.action = job.move.run
                ? 'run'
                : 'walk';

            faceToward(
                attacker.root,
                job.from,
                target
            );

            moveBetween(
                attacker.root,
                job.from,
                target,
                t
            );

            if (job.time >= duration) {
                job.from = target;
                job.index++;
                job.time = 0;
            }

            return;
        }

        if (job.stage === 'capture') {
            const capture =
                job.move.captures[job.captureIndex];

            if (!capture) {
                job.stage = 'finish';
                job.time = 0;
                setEffect(null);
                return;
            }

            const victim =
                actors.current.get(capture.victimId);

            const victimPiece = game.pieces.find(
                piece => piece.id === capture.victimId
            );

            if (!victim || !victimPiece) {
                job.captureIndex++;
                job.captureStarted = false;
                job.time = 0;
                return;
            }

            const homeIndex = Number(
                capture.victimId.split('-p')[1] ?? 0
            ) % 4;

            const home =
                layout.slots[
                victimPiece.ownerSeat
                ][homeIndex];

            if (!job.captureStarted) {
                job.captureStarted = true;
                job.time = 0;
                job.victimFrom = vec(
                    victim.root.position
                );

                setEffect({
                    style: capture.style as CaptureStyle,
                    label:
                        capture.style === 'SLAP'
                            ? 'SMACK!'
                            : capture.style === 'DOG'
                                ? 'WOOF! RUN!'
                                : capture.weapon === 'RIFLE'
                                    ? 'RIFLE! POP!'
                                    : 'BANG! POP!',
                    position: [
                        attacker.root.position.x,
                        0,
                        attacker.root.position.z,
                    ],
                });
            }

            job.time += delta;

            const duration = Math.max(
                1.7,
                Math.min(capture.lockMs / 1000, 3.2)
            );

            const t = Math.min(
                job.time / duration,
                1
            );

            const start =
                job.victimFrom ?? vec(victim.root.position);

            if (capture.style === 'SLAP') {
                attacker.action =
                    t < 0.35 ? 'slap' : 'idle';

                victim.action =
                    t < 0.35 ? 'panic' : 'run';

                if (t >= 0.35) {
                    const progress = smooth(
                        (t - 0.35) / 0.65
                    );

                    faceToward(
                        victim.root,
                        start,
                        home
                    );

                    moveBetween(
                        victim.root,
                        start,
                        home,
                        progress
                    );
                }
            }

            if (capture.style === 'DOG') {
                attacker.action = 'idle';
                victim.action = 'panic';

                const progress = smooth(
                    (t - 0.14) / 0.86
                );

                faceToward(
                    victim.root,
                    start,
                    home
                );

                moveBetween(
                    victim.root,
                    start,
                    home,
                    progress
                );

                const dog = dogRef.current;

                if (dog) {
                    dog.visible = t >= 0.1;

                    const chase = smooth(
                        (t - 0.23) / 0.75
                    );

                    const dogStart: Vec3 = [
                        start[0] - 0.45,
                        0,
                        start[2] - 0.45,
                    ];

                    const dogEnd: Vec3 = [
                        home[0] - 0.45,
                        0,
                        home[2] - 0.45,
                    ];

                    moveBetween(
                        dog,
                        dogStart,
                        dogEnd,
                        chase
                    );

                    faceToward(
                        dog,
                        dogStart,
                        dogEnd
                    );
                }
            }

            if (capture.style === 'GUN') {
                attacker.action =
                    t <= 0.65 ? 'shoot' : 'idle';

                victim.action =
                    t < 0.28 ? 'panic' : 'fall';

                if (t > 0.32) {
                    victim.root.scale.setScalar(
                        Math.max(
                            0.015,
                            1 - (t - 0.32) / 0.5
                        )
                    );
                }
            }

            if (t >= 1) {
                victim.action = 'idle';
                attacker.action = 'idle';

                victim.root.scale.setScalar(1);
                victim.root.rotation.set(0, 0, 0);
                place(victim.root, home);

                if (dogRef.current) {
                    dogRef.current.visible = false;
                }

                job.captureIndex++;
                job.captureStarted = false;
                job.victimFrom = null;
                job.time = 0;

                setEffect(null);
            }

            return;
        }

        job.time += delta;

        if (job.time >= 0.15) {
            if (job.move.pieceHome) {
                attacker.action = 'celebrate';
            } else {
                attacker.action = 'idle';
            }

            const resolve = job.resolve;
            jobRef.current = null;
            setEffect(null);
            resolve();
        }
    });

    return null;
}
