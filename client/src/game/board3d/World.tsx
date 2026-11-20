import * as THREE from 'three';
import { useMemo, type MutableRefObject } from 'react';
import { type Piece } from '@ludo-rush/shared';
import { createLayout, piecePosition, playerColor, routeForPiece, type Vec3 } from '../boardLayout';
import { type Props, type MoveJob, type FXState, type ActorRegistry, type CameraActions, type FocusRef } from './types';
import { Tile } from './Tile';
import { Home } from './Home';
import { Character } from './Character';
import { CartoonDog } from './CartoonDog';
import { CaptureEffect } from './CaptureEffect';
import { HomeCamera } from './HomeCamera';
import { AnimationDirector } from './AnimationDirector';

export function World({
    game,
    validPieceIds,
    onPieceClick,
    showRoutes,
    viewSeat,
    starsPerSegment,
    seatLabels,
    jobRef,
    actors,
    dogRef,
    cameraActions,
    effect,
    setEffect,
    focus,
}: Props & {
    jobRef: MutableRefObject<MoveJob | null>;
    actors: ActorRegistry;
    dogRef: MutableRefObject<THREE.Group | null>;
    cameraActions: CameraActions;
    effect: FXState | null;
    setEffect: (effect: FXState | null) => void;
    focus: FocusRef;
}) {
    const layout = useMemo(
        () => createLayout(
            game,
            starsPerSegment ?? 1
        ),
        [
            game.N,
            game.S,
            game.H,
            starsPerSegment,
        ]
    );

    const compact = game.N > 8;

    // Corners nobody sits in (2 and 3 player games) stay neutral and empty.
    const inPlay = useMemo(
        () => new Set(game.pieces.map(p => p.ownerSeat)),
        [game.pieces]
    );
    const seatColor = (seat: number) =>
        inPlay.has(seat) ? playerColor(seat, game.N) : '#d8c79d';

    const legal = useMemo(
        () => new Set(validPieceIds),
        [validPieceIds]
    );

    const positions = useMemo(() => {
        const groups = new Map<string, Piece[]>();

        for (const piece of game.pieces) {
            const key =
                piece.progress < 0
                    ? piece.id
                    : piece.progress >= game.L
                        ? `lane-${piece.ownerSeat}-${piece.progress}`
                        : `ring-${(piece.ownerSeat * game.S +
                            piece.progress) %
                        game.L
                        }`;

            const list = groups.get(key) ?? [];
            list.push(piece);
            groups.set(key, list);
        }

        const result = new Map<string, Vec3>();

        for (const list of groups.values()) {
            list.forEach((piece, i) => {
                const pos: Vec3 = [
                    ...piecePosition(piece, game, layout),
                ];

                if (list.length > 1 && piece.progress >= 0 && piece.progress < game.L + game.H) {
                    const angle =
                        (2 * Math.PI * i) / list.length;

                    pos[0] += Math.cos(angle) * 0.19;
                    pos[2] += Math.sin(angle) * 0.19;
                }

                result.set(piece.id, pos);
            });
        }

        return result;
    }, [game, layout]);

    const highlights = useMemo(() => {
        const result = new Set<number>();

        if (
            !showRoutes ||
            game.dice === null ||
            validPieceIds.length === 0
        ) {
            return result;
        }

        for (const id of validPieceIds) {
            const piece = game.pieces.find(
                item => item.id === id
            );

            if (!piece) continue;

            const route = routeForPiece(
                piece,
                game.dice,
                game,
                layout
            );

            for (const point of route) {
                const index = layout.ring.findIndex(
                    candidate =>
                        Math.abs(candidate[0] - point[0]) < 0.001 &&
                        Math.abs(candidate[2] - point[2]) < 0.001
                );

                if (index >= 0) result.add(index);
            }
        }

        return result;
    }, [
        game,
        layout,
        validPieceIds,
        showRoutes,
    ]);

    return (
        <>
            <color
                attach="background"
                args={['#2d1d12']}
            />

            <ambientLight intensity={0.8} />

            <hemisphereLight
                args={['#fff1d6', '#7a4a2a', 1.0]}
            />

            <directionalLight
                position={[12, 24, 10]}
                intensity={2.0}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-35}
                shadow-camera-right={35}
                shadow-camera-top={35}
                shadow-camera-bottom={-35}
            />

            <HomeCamera
                layout={layout}
                seat={
                    Math.max(
                        0,
                        Math.min(viewSeat, game.N - 1)
                    )
                }
                actions={cameraActions}
                focus={focus}
            />

            {layout.mode === 'classic' && (
                <group position={[0, -0.4, 0]}>
                    {([
                        [0, 7.6, 15.7, 0.5],
                        [0, -7.6, 15.7, 0.5],
                        [7.6, 0, 0.5, 14.7],
                        [-7.6, 0, 0.5, 14.7],
                    ] as const).map(([x, z, w, d], i) => (
                        <mesh key={`frame-${i}`} position={[x, 0, z]} castShadow receiveShadow>
                            <boxGeometry args={[w, 0.8, d]} />
                            <meshStandardMaterial color="#8a5428" roughness={0.6} />
                        </mesh>
                    ))}
                </group>
            )}

            {layout.mode === 'classic' ? (
                <mesh position={[0, -0.53, 0]} receiveShadow castShadow>
                    <boxGeometry args={[14.7, 0.67, 14.7]} />
                    <meshStandardMaterial color="#efdcae" roughness={0.85} />
                </mesh>
            ) : (
                layout.star && (
                    <group position={[0, -0.53, 0]}>
                        <mesh receiveShadow castShadow>
                            <cylinderGeometry args={[layout.star.hub, layout.star.hub, 0.67, 48]} />
                            <meshStandardMaterial color="#efdcae" roughness={0.85} />
                        </mesh>
                        {layout.star.arms.map((arm, i) => (
                            <mesh
                                key={`arm-${i}`}
                                position={[arm.pos[0], 0, arm.pos[2]]}
                                rotation={[0, arm.rot, 0]}
                                receiveShadow
                                castShadow
                            >
                                <boxGeometry args={[arm.length, 0.67, arm.width]} />
                                <meshStandardMaterial color="#efdcae" roughness={0.85} />
                            </mesh>
                        ))}
                    </group>
                )
            )}

            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.89, 0]}
                receiveShadow
            >
                <planeGeometry args={[150, 150]} />
                <meshStandardMaterial
                    color="#6a4023"
                    roughness={0.95}
                />
            </mesh>

            {layout.mode === 'classic' &&
                layout.bases.map((base, seat) => (
                    <mesh
                        key={`yard-${seat}`}
                        receiveShadow
                        position={[
                            base[0],
                            -0.185,
                            base[2],
                        ]}
                    >
                        <boxGeometry args={[5.25, 0.10, 5.25]} />
                        <meshStandardMaterial
                            color={inPlay.has(seat) ? playerColor(seat, game.N) : '#d8c79d'}
                        />
                    </mesh>
                ))}

            {layout.ring.map((position, index) => {
                const seat = Math.floor(
                    index / game.S
                );

                const next =
                    layout.ring[
                    (index + 1) % layout.ring.length
                    ];

                const angle = Math.atan2(
                    next[0] - position[0],
                    next[2] - position[2]
                );

                return (
                    <Tile
                        key={`ring-${index}`}
                        position={position}
                        size={layout.tileSize}
                        color={seatColor(seat)}
                        safe={layout.safe.has(index)}
                        start={index % game.S === 0}
                        highlighted={highlights.has(index)}
                        lane={false}
                        rotation={layout.ringRot?.[index] ?? 0}
                        arrow={
                            index % 4 === 0
                                ? angle
                                : null
                        }
                    />
                );
            })}

            {layout.lanes.flatMap((lane, seat) =>
                lane.map((position, index) => (
                    <Tile
                        key={`lane-${seat}-${index}`}
                        position={position}
                        size={layout.tileSize * 0.92}
                        color={seatColor(seat)}
                        safe={false}
                        start={false}
                        highlighted={false}
                        lane
                        rotation={layout.laneRot?.[seat]?.[index] ?? 0}
                        arrow={null}
                    />
                ))
            )}

            <mesh
                position={[0, 0.09, 0]}
                castShadow
            >
                <cylinderGeometry
                    args={[0.61, 0.68, 0.25, 32]}
                />
                <meshStandardMaterial
                    color="#ffcc32"
                    roughness={0.4}
                />
            </mesh>

            {layout.bases.map((base, seat) => inPlay.has(seat) && (
                <Home
                    key={`home-${seat}`}
                    label={seatLabels?.[seat]}
                    base={base}
                    color={playerColor(seat, game.N)}
                    seat={seat}
                    active={seat === game.turnSeat}
                    compact={compact}
                />
            ))}

            {game.pieces.map(piece => (
                <Character
                    key={piece.id}
                    piece={piece}
                    game={game}
                    position={
                        positions.get(piece.id) ?? [0, 0, 0]
                    }
                    legal={legal.has(piece.id)}
                    registry={actors}
                    onPick={onPieceClick}
                    compact={compact}
                />
            ))}

            <CartoonDog dogRef={dogRef} />


            <CaptureEffect effect={effect} />

            <AnimationDirector
                game={game}
                layout={layout}
                jobRef={jobRef}
                actors={actors}
                dogRef={dogRef}
                setEffect={setEffect}
                focus={focus}
            />
        </>
    );
}
