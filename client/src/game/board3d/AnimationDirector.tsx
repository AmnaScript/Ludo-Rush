import * as THREE from 'three';
import { type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { type GameState } from '@ludo-rush/shared';
import { cellPosition, type BoardLayout, type Vec3 } from '../boardLayout';
import { type CaptureStyle, type MoveJob, type FXState, type ActorRegistry } from './types';
import { SCENE, ramp, sceneSeconds } from './scenes';
import { screen } from './screen';
import { play } from '../../audio/sfx';
import { vec, place, moveBetween, faceToward, faceSide, smooth, timeScale } from './helpers';

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

        const delta = Math.min(deltaRaw, 0.06) * timeScale();
        const attacker = actors.current.get(job.move.pieceId);

        if (!attacker) {
            jobRef.current = null;
            job.resolve();
            return;
        }

        if (job.stage === 'travel') {
            // On a capture the attacker stops one tile BEHIND the victim,
            // plays the scene, and only then steps into the victim's tile.
            const travelCount = job.move.captures.length
                ? Math.max(0, job.move.path.length - 1)
                : job.move.path.length;

            if (job.index >= travelCount) {
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
                play('step');
                job.index++;
                job.time = 0;
            }

            return;
        }

        if (job.stage === 'capture') {
            const capture =
                job.move.captures[job.captureIndex];

            if (!capture) {
                job.stage = 'stepin';
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

            const style = capture.style as CaptureStyle;
            const dur = sceneSeconds(style, capture.lockMs);

            if (!job.captureStarted) {
                job.captureStarted = true;
                job.time = 0;
                job.victimFrom = vec(victim.root.position);
                job.attackerFrom = vec(attacker.root.position);

                // The attacker stands to one side of the victim so the whole
                // scene can be seen from above: left or right, never on top.
                const dx = job.attackerFrom[0] - job.victimFrom[0];
                const dz = job.attackerFrom[2] - job.victimFrom[2];
                const rightOf = dx * screen.right.x + dz * screen.right.z;
                let sideSign = rightOf > 0.05 ? 1 : -1;
                const gap = SCENE[style].gap / screen.stretch; // a screen distance; the board is stretched
                // keep the whole scene on the board: if that side runs off the edge, use the other
                const reach = (sign: number) => {
                    const x = job.victimFrom![0] + screen.right.x * sign * gap;
                    const z = job.victimFrom![2] + screen.right.z * sign * gap;
                    return Math.max(Math.abs(x), Math.abs(z));
                };
                if (reach(sideSign) > 7.2 && reach(-sideSign) < reach(sideSign)) sideSign = -sideSign;
                job.stagePos = [
                    job.victimFrom[0] + screen.right.x * sideSign * gap,
                    0,
                    job.victimFrom[2] + screen.right.z * sideSign * gap,
                ];

                if (style === 'GUN') play('gun');
                else if (style === 'SLAP') play('slap');
                else {
                    play('whistle');
                    window.setTimeout(() => play('bark'), SCENE.DOG.bite * dur * 1000);
                    window.setTimeout(() => play('door'), dur * 850);
                }

                setEffect({
                    style,
                    label: style,
                    duration: dur,
                    attackerSeat: game.pieces.find(piece => piece.id === job.move.pieceId)?.ownerSeat ?? 0,
                    victimSeat: victimPiece.ownerSeat,
                    attackerId: job.move.pieceId,
                    victimId: capture.victimId,
                    homePos: home,
                });
            }

            job.time += delta;
            const t = Math.min(job.time / dur, 1);
            const start = job.victimFrom ?? vec(victim.root.position);
            const from = job.attackerFrom ?? vec(attacker.root.position);
            const stage = job.stagePos ?? from;

            // both characters grow a little so the scene is easy to see
            const grow = 1 + 0.8 * smooth(Math.min(t / 0.12, 1)) * (1 - smooth(Math.max(0, (t - 0.93) / 0.07)));
            attacker.root.scale.setScalar(grow);
            if (victim.root.scale.x > 0.5 || t < 0.5) victim.root.scale.setScalar(grow);

            // walk in from the tile behind to the stage position
            const slide = smooth(t / 0.16);
            const attackerAt = (gapNow: number): Vec3 => {
                const dir = [stage[0] - start[0], stage[2] - start[2]];
                const len = Math.hypot(dir[0], dir[1]) || 1;
                return [
                    start[0] + (dir[0] / len) * gapNow,
                    0,
                    start[2] + (dir[1] / len) * gapNow,
                ];
            };
            const gap0 = Math.hypot(stage[0] - start[0], stage[2] - start[2]) || 1;
            // unit vector pointing from the attacker's side to the other side of the victim
            const awayX = (start[0] - stage[0]) / gap0;
            const awayZ = (start[2] - stage[2]) / gap0;

            if (style === 'SLAP') {
                const S = SCENE.SLAP;
                // 1. step in (0-.16)  2. wind up  3. lunge + slap at S.hit  4. victim flies home
                const lunge = smooth(ramp(t, S.hit - 0.12, S.hit)) * (1 - smooth(ramp(t, S.hit + 0.04, S.hit + 0.2)));
                const g = gap0 + (S.lunge / screen.stretch - gap0) * lunge;
                const pos = t < 0.16
                    ? ([
                          from[0] + (stage[0] - from[0]) * slide,
                          0,
                          from[2] + (stage[2] - from[2]) * slide,
                      ] as Vec3)
                    : attackerAt(g);
                place(attacker.root, pos);
                faceSide(attacker.root, pos, start);
                attacker.action = t < 0.16 ? 'walk' : t < S.hit + 0.12 ? 'slap' : 'idle';

                faceSide(victim.root, start, pos);
                if (t < S.hit) {
                    victim.action = 'idle';
                } else if (t < S.hit + 0.18) {
                    // knocked back, dizzy
                    victim.action = 'panic';
                    const k = smooth(ramp(t, S.hit, S.hit + 0.18));
                    victim.root.position.set(start[0] + awayX * (0.7 / screen.stretch) * k, 0, start[2] + awayZ * (0.7 / screen.stretch) * k);
                } else {
                    victim.action = 'run';
                    const cur = vec(victim.root.position);
                    const progress = smooth(ramp(t, S.hit + 0.18, 1));
                    faceToward(victim.root, cur, home);
                    moveBetween(victim.root, job.slapFrom ?? (job.slapFrom = cur), home, progress);
                }
            }

            if (style === 'GUN') {
                const G = SCENE.GUN;
                const pos = t < 0.16
                    ? ([
                          from[0] + (stage[0] - from[0]) * slide,
                          0,
                          from[2] + (stage[2] - from[2]) * slide,
                      ] as Vec3)
                    : attackerAt(gap0 + (t > G.fire && t < G.fire + 0.1 ? 0.18 / screen.stretch : 0));
                place(attacker.root, pos);
                faceSide(attacker.root, pos, start);
                attacker.action = t < 0.16 ? 'walk' : t < G.hit + 0.28 ? 'shoot' : 'idle';

                faceSide(victim.root, start, pos);
                if (t < G.hit) {
                    victim.action = t < G.fire ? 'panic' : 'panic';
                } else {
                    victim.action = 'fall';
                    const back = smooth(ramp(t, G.hit, G.hit + 0.15));
                    victim.root.position.set(start[0] + awayX * (0.5 / screen.stretch) * back, 0, start[2] + awayZ * (0.5 / screen.stretch) * back);
                    if (t > G.hit + 0.22) {
                        victim.root.scale.setScalar(Math.max(0.015, grow * (1 - ramp(t, G.hit + 0.22, G.hit + 0.5))));
                    }
                }
            }

            if (style === 'DOG') {
                const D = SCENE.DOG;
                const pos = t < 0.16
                    ? ([
                          from[0] + (stage[0] - from[0]) * slide,
                          0,
                          from[2] + (stage[2] - from[2]) * slide,
                      ] as Vec3)
                    : attackerAt(gap0);
                place(attacker.root, pos);
                faceSide(attacker.root, pos, start);
                attacker.action = 'idle';

                const dog = dogRef.current;
                const dogBehind: Vec3 = [
                    pos[0] + (pos[0] - start[0]) * 0.9,
                    0,
                    pos[2] + (pos[2] - start[2]) * 0.9,
                ];

                if (t < D.bite) {
                    faceSide(victim.root, start, pos);
                    victim.action = t > D.whistle ? 'panic' : 'idle';
                } else {
                    victim.action = 'run';
                    const cur = vec(victim.root.position);
                    const progress = smooth(ramp(t, D.bite, 1));
                    faceToward(victim.root, cur, home);
                    moveBetween(victim.root, job.slapFrom ?? (job.slapFrom = cur), home, progress);
                }

                if (dog) {
                    dog.visible = t >= D.whistle - 0.02;
                    dog.scale.setScalar(grow);
                    if (t < D.bite) {
                        // runs in from behind the attacker straight at the victim
                        const k = smooth(ramp(t, D.whistle - 0.02, D.bite));
                        const dp: Vec3 = [
                            dogBehind[0] + (start[0] - dogBehind[0]) * k,
                            0,
                            dogBehind[2] + (start[2] - dogBehind[2]) * k,
                        ];
                        place(dog, dp);
                        faceSide(dog, dogBehind, start);
                    } else {
                        // chases the victim all the way home, snapping at their heels
                        const vp = vec(victim.root.position);
                        const dx = vp[0] - home[0];
                        const dz = vp[2] - home[2];
                        const len = Math.hypot(dx, dz) || 1;
                        place(dog, [vp[0] + (dx / len) * (0.9 / screen.stretch), 0, vp[2] + (dz / len) * (0.9 / screen.stretch)]);
                        faceToward(dog, vec(dog.position), home);
                    }
                }
            }

            if (t >= 1) {
                victim.action = 'idle';
                attacker.action = 'idle';

                victim.root.scale.setScalar(1);
                attacker.root.scale.setScalar(1);
                victim.root.rotation.set(0, 0, 0);
                victim.root.userData.yaw = 0;
                place(victim.root, home);
                job.from = vec(attacker.root.position);

                if (dogRef.current) {
                    dogRef.current.visible = false;
                }

                job.captureIndex++;
                job.captureStarted = false;
                job.victimFrom = null;
                job.attackerFrom = null;
                job.stagePos = null;
                job.slapFrom = null;
                job.time = 0;

                setEffect(null);
            }

            return;
        }

        if (job.stage === 'stepin') {
            const last = job.move.path[job.move.path.length - 1];

            if (!last) {
                job.stage = 'finish';
                job.time = 0;
                return;
            }

            const target = cellPosition(last, layout);
            const duration = 0.3;

            job.time += delta;
            attacker.action = 'walk';
            faceToward(attacker.root, job.from, target);
            moveBetween(
                attacker.root,
                job.from,
                target,
                smooth(job.time / duration)
            );

            if (job.time >= duration) {
                job.from = target;
                attacker.action = 'idle';
                job.stage = 'finish';
                job.time = 0;
            }

            return;
        }

        if (job.stage === 'penalty') {
            const penalty = job.move.penalty;
            const victim = penalty
                ? actors.current.get(penalty.pieceId)
                : undefined;
            const piece = penalty
                ? game.pieces.find(p => p.id === penalty.pieceId)
                : undefined;

            if (!penalty || !victim || !piece) {
                job.penaltyDone = true;
                job.stage = 'finish';
                job.time = 0;
                return;
            }

            const homeIndex =
                Number(penalty.pieceId.split('-p')[1] ?? 0) % 4;
            const home = layout.slots[piece.ownerSeat][homeIndex];
            const duration = SCENE.PENALTY.seconds;

            if (!job.captureStarted) {
                job.captureStarted = true;
                job.time = 0;
                play('fall');
                setEffect({
                    style: 'PENALTY',
                    label: 'OOPS!',
                    duration,
                    attackerSeat: piece.ownerSeat,
                    victimSeat: piece.ownerSeat,
                    attackerId: penalty.pieceId,
                    victimId: penalty.pieceId,
                    homePos: home,
                });
            }

            job.time += delta;
            const t = Math.min(job.time / duration, 1);

            victim.action = t < 0.35 ? 'panic' : 'fall';

            if (t > 0.4) {
                victim.root.scale.setScalar(
                    Math.max(0.015, 1 - (t - 0.4) / 0.45)
                );
            }

            if (t >= 1) {
                victim.action = 'idle';
                victim.root.scale.setScalar(1);
                victim.root.rotation.set(0, 0, 0);
                place(victim.root, home);
                job.penaltyDone = true;
                job.captureStarted = false;
                job.stage = 'finish';
                job.time = 0;
                setEffect(null);
            }

            return;
        }

        job.time += delta;

        if (job.move.penalty && !job.penaltyDone) {
            job.stage = 'penalty';
            job.time = 0;
            job.captureStarted = false;
            return;
        }

        if (job.time >= 0.15) {
            if (job.move.pieceHome) {
                play('home');
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
