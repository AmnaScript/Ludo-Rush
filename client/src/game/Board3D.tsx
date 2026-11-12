
import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
} from 'react';

import {
    Canvas,
    useFrame,
    useThree,
} from '@react-three/fiber';

import {
    OrbitControls,
    RoundedBox,
    Text,
} from '@react-three/drei';

import * as THREE from 'three';

import type {
    GameState,
    MoveResult,
    Piece,
} from '@ludo-rush/shared';

import {
    cellPosition,
    createLayout,
    piecePosition,
    playerColor,
    routeForPiece,
    type BoardLayout,
    type Vec3,
} from './boardLayout';

import { SceneDecor } from './SceneDecor';

export interface Board3DHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    playMove: (move: MoveResult) => Promise<void>;
}

interface Props {
    game: GameState;
    validPieceIds: string[];
    onPieceClick: (id: string) => void;
    showRoutes: boolean;
    viewSeat: number;
    starsPerSegment?: number;
}

type Action =
    | 'idle'
    | 'walk'
    | 'run'
    | 'slap'
    | 'shoot'
    | 'panic'
    | 'fall'
    | 'celebrate';

type CaptureStyle = 'SLAP' | 'DOG' | 'GUN';

interface ActorData {
    root: THREE.Group;
    action: Action;
}

interface MoveJob {
    move: MoveResult;
    resolve: () => void;
    stage: 'travel' | 'capture' | 'finish';
    index: number;
    time: number;
    from: Vec3;
    captureIndex: number;
    captureStarted: boolean;
    victimFrom: Vec3 | null;
}

interface FXState {
    style: CaptureStyle;
    label: string;
    position: Vec3;
}

type ActorRegistry = MutableRefObject<
    Map<string, ActorData>
>;

function vec(position: THREE.Vector3): Vec3 {
    return [
        position.x,
        position.y,
        position.z,
    ];
}

function place(
    object: THREE.Object3D,
    position: Vec3
): void {
    object.position.set(...position);
}

function moveBetween(
    object: THREE.Object3D,
    from: Vec3,
    to: Vec3,
    t: number
): void {
    object.position.set(
        THREE.MathUtils.lerp(from[0], to[0], t),
        THREE.MathUtils.lerp(from[1], to[1], t),
        THREE.MathUtils.lerp(from[2], to[2], t)
    );
}

function faceToward(
    object: THREE.Object3D,
    from: Vec3,
    to: Vec3
): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];

    if (Math.hypot(dx, dz) > 0.005) {
        object.rotation.y = Math.atan2(dx, dz);
    }
}

function smooth(t: number): number {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

function Tile({
    position,
    size,
    color,
    start,
    safe,
    highlighted,
    lane,
    arrow,
}: {
    position: Vec3;
    size: number;
    color: string;
    start: boolean;
    safe: boolean;
    highlighted: boolean;
    lane: boolean;
    arrow: number | null;
}) {
    const fill = highlighted
        ? '#ffe864'
        : lane || start
            ? color
            : '#ffffff';

    return (
        <group position={position}>
            <RoundedBox
                args={[size, 0.18, size]}
                radius={size * 0.09}
                smoothness={2}
                position={[0, 0.1, 0]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={fill}
                    roughness={0.55}
                />
            </RoundedBox>

            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.198, 0]}
            >
                <planeGeometry
                    args={[size * 0.85, size * 0.85]}
                />
                <meshBasicMaterial
                    color={
                        highlighted
                            ? '#ffc53d'
                            : lane
                                ? '#ffffff'
                                : '#dceaf3'
                    }
                    transparent
                    opacity={
                        highlighted
                            ? 0.6
                            : lane
                                ? 0.12
                                : 0.14
                    }
                />
            </mesh>

            {(safe || start) && !lane && (
                <Text
                    position={[0, 0.218, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={size * 0.4}
                    color={start ? '#213748' : '#e4a323'}
                    anchorX="center"
                    anchorY="middle"
                >
                    {start ? '●' : '★'}
                </Text>
            )}

            {arrow !== null && !safe && !lane && !start && (
                <group
                    position={[0, 0.22, 0]}
                    rotation={[0, arrow, 0]}
                >
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <coneGeometry
                            args={[size * 0.13, size * 0.23, 3]}
                        />
                        <meshBasicMaterial
                            color="#698394"
                            side={THREE.DoubleSide}
                            transparent
                            opacity={0.65}
                        />
                    </mesh>
                </group>
            )}

            {highlighted && (
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.225, 0]}
                >
                    <ringGeometry
                        args={[size * 0.34, size * 0.44, 24]}
                    />
                    <meshBasicMaterial
                        color="#ff9700"
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}

function Home({
    base,
    color,
    seat,
    active,
    compact,
}: {
    base: Vec3;
    color: string;
    seat: number;
    active: boolean;
    compact: boolean;
}) {
    const size = compact ? 0.58 : 0.95;

    return (
        <group position={base}>
            <mesh
                position={[0, -0.12, 0]}
                castShadow
                receiveShadow
            >
                <cylinderGeometry
                    args={[size * 0.95, size, 0.12, 20]}
                />
                <meshStandardMaterial color="#e8f7df" />
            </mesh>

            <RoundedBox
                args={[
                    size,
                    size * 0.68,
                    size * 0.88,
                ]}
                radius={0.09}
                position={[0, size * 0.32, 0]}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color="#fff6e4" />
            </RoundedBox>

            <mesh
                position={[0, size * 0.99, 0]}
                rotation={[0, Math.PI / 4, 0]}
                castShadow
            >
                <coneGeometry
                    args={[size * 0.85, size * 0.72, 4]}
                />
                <meshStandardMaterial
                    color={color}
                    roughness={0.52}
                />
            </mesh>

            <mesh
                position={[
                    0,
                    size * 0.21,
                    size * 0.46,
                ]}
            >
                <boxGeometry
                    args={[
                        size * 0.25,
                        size * 0.41,
                        0.055,
                    ]}
                />
                <meshStandardMaterial color="#72432f" />
            </mesh>

            <Text
                position={[0, size * 1.58, 0]}
                fontSize={compact ? 0.24 : 0.35}
                color={color}
                outlineColor="#243040"
                outlineWidth={0.028}
            >
                P{seat + 1}
            </Text>

            {active && (
                <mesh
                    position={[0, 0.015, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <ringGeometry
                        args={[size * 0.89, size * 1.05, 32]}
                    />
                    <meshBasicMaterial
                        color="#ffcb26"
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}
        </group>
    );
}

function Character({
    piece,
    game,
    position,
    legal,
    registry,
    onPick,
    compact,
}: {
    piece: Piece;
    game: GameState;
    position: Vec3;
    legal: boolean;
    registry: ActorRegistry;
    onPick: (pieceId: string) => void;
    compact: boolean;
}) {
    const root = useRef<THREE.Group>(null);
    const body = useRef<THREE.Group>(null);
    const armL = useRef<THREE.Group>(null);
    const armR = useRef<THREE.Group>(null);
    const legL = useRef<THREE.Group>(null);
    const legR = useRef<THREE.Group>(null);
    const gun = useRef<THREE.Group>(null);
    const flash = useRef<THREE.Mesh>(null);

    const down = useRef<[number, number] | null>(null);

    const color = playerColor(
        piece.ownerSeat,
        game.N
    );

    const scale = compact ? 0.62 : 0.84;

    useEffect(() => {
        const object = root.current;
        if (!object) return;

        registry.current.set(piece.id, {
            root: object,
            action: 'idle',
        });

        return () => {
            registry.current.delete(piece.id);
        };
    }, [piece.id, registry]);

    useEffect(() => {
        const object = root.current;
        if (!object) return;

        const animation = registry.current.get(piece.id);

        if (animation && animation.action !== 'idle') {
            return;
        }

        place(object, position);
        object.scale.setScalar(1);
        object.rotation.z = 0;
        object.rotation.x = 0;
        object.visible = true;
    }, [
        piece.progress,
        position[0],
        position[1],
        position[2],
        piece.id,
        registry,
    ]);

    useFrame(({ clock }) => {
        const entry = registry.current.get(piece.id);
        if (!entry || !body.current) return;

        const action = entry.action;
        const t = clock.elapsedTime;

        const speed =
            action === 'run' || action === 'panic'
                ? 15
                : action === 'walk'
                    ? 9
                    : 2;

        const amplitude =
            action === 'run' || action === 'panic'
                ? 0.85
                : action === 'walk'
                    ? 0.55
                    : 0.025;

        const stride = Math.sin(t * speed) * amplitude;

        if (legL.current) {
            legL.current.rotation.x = stride;
        }

        if (legR.current) {
            legR.current.rotation.x = -stride;
        }

        if (armL.current) {
            armL.current.rotation.x =
                action === 'slap'
                    ? -1.7 + Math.sin(t * 16) * 0.38
                    : -stride * 0.9;
        }

        if (armR.current) {
            armR.current.rotation.x =
                action === 'shoot'
                    ? -Math.PI / 2
                    : stride * 0.9;
        }

        if (gun.current) {
            gun.current.visible =
                action === 'shoot';
        }

        if (flash.current) {
            flash.current.visible =
                action === 'shoot' &&
                Math.sin(t * 24) > -0.2;
        }

        body.current.position.y =
            action === 'idle'
                ? Math.sin(t * 2) * 0.025
                : Math.abs(Math.sin(t * speed)) * 0.1;

        body.current.rotation.z =
            action === 'panic'
                ? Math.sin(t * 16) * 0.14
                : action === 'fall'
                    ? 1.1
                    : action === 'celebrate'
                        ? Math.sin(t * 8) * 0.18
                        : 0;

        if (action === 'celebrate') {
            if (armL.current) {
                armL.current.rotation.z = 1.9;
            }
            if (armR.current) {
                armR.current.rotation.z = -1.9;
            }
        } else {
            if (armL.current) armL.current.rotation.z = 0;
            if (armR.current) armR.current.rotation.z = 0;
        }
    });

    return (
        <group ref={root} position={position}>
            {legal && (
                <mesh
                    position={[0, 0.04, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                >
                    <ringGeometry
                        args={[
                            0.26 * scale,
                            0.39 * scale,
                            28,
                        ]}
                    />
                    <meshBasicMaterial
                        color="#ffb300"
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            <group scale={scale}>
                <group ref={body}>
                    <mesh
                        castShadow
                        position={[0, 0.61, 0]}
                    >
                        <capsuleGeometry
                            args={[0.19, 0.32, 6, 12]}
                        />
                        <meshStandardMaterial color={color} />
                    </mesh>

                    <mesh
                        castShadow
                        position={[0, 1.05, 0]}
                    >
                        <sphereGeometry args={[0.22, 16, 12]} />
                        <meshStandardMaterial color="#f5b88d" />
                    </mesh>

                    <mesh
                        castShadow
                        position={[0, 1.20, -0.035]}
                    >
                        <sphereGeometry args={[0.21, 14, 10]} />
                        <meshStandardMaterial color="#302635" />
                    </mesh>

                    {[-0.088, 0.088].map(x => (
                        <mesh
                            key={`eye-${x}`}
                            position={[x, 1.07, 0.205]}
                        >
                            <sphereGeometry args={[0.024, 8, 8]} />
                            <meshBasicMaterial color="#172538" />
                        </mesh>
                    ))}

                    <group
                        ref={armL}
                        position={[-0.26, 0.79, 0]}
                    >
                        <mesh
                            castShadow
                            position={[0, -0.17, 0]}
                        >
                            <capsuleGeometry
                                args={[0.077, 0.24, 5, 8]}
                            />
                            <meshStandardMaterial color={color} />
                        </mesh>

                        <mesh
                            castShadow
                            position={[0, -0.37, 0]}
                        >
                            <sphereGeometry args={[0.09, 10, 8]} />
                            <meshStandardMaterial color="#f5b88d" />
                        </mesh>
                    </group>

                    <group
                        ref={armR}
                        position={[0.26, 0.79, 0]}
                    >
                        <mesh
                            castShadow
                            position={[0, -0.17, 0]}
                        >
                            <capsuleGeometry
                                args={[0.077, 0.24, 5, 8]}
                            />
                            <meshStandardMaterial color={color} />
                        </mesh>

                        <mesh
                            castShadow
                            position={[0, -0.37, 0]}
                        >
                            <sphereGeometry args={[0.09, 10, 8]} />
                            <meshStandardMaterial color="#f5b88d" />
                        </mesh>

                        <group
                            ref={gun}
                            visible={false}
                            position={[0, -0.37, 0.20]}
                        >
                            <mesh castShadow>
                                <boxGeometry args={[0.13, 0.14, 0.47]} />
                                <meshStandardMaterial
                                    color="#33414e"
                                    metalness={0.35}
                                />
                            </mesh>

                            <mesh position={[0, -0.13, -0.12]}>
                                <boxGeometry args={[0.10, 0.22, 0.12]} />
                                <meshStandardMaterial color="#1f2634" />
                            </mesh>

                            <mesh
                                ref={flash}
                                visible={false}
                                position={[0, 0, 0.34]}
                                rotation={[Math.PI / 2, 0, 0]}
                            >
                                <coneGeometry args={[0.15, 0.34, 7]} />
                                <meshBasicMaterial
                                    color="#fff22e"
                                    toneMapped={false}
                                />
                            </mesh>
                        </group>
                    </group>

                    {[-0.11, 0.11].map((x, index) => (
                        <group
                            key={index}
                            ref={index === 0 ? legL : legR}
                            position={[x, 0.34, 0]}
                        >
                            <mesh
                                castShadow
                                position={[0, -0.16, 0]}
                            >
                                <capsuleGeometry
                                    args={[0.086, 0.24, 5, 9]}
                                />
                                <meshStandardMaterial color="#29415b" />
                            </mesh>

                            <mesh
                                castShadow
                                position={[0, -0.32, 0.09]}
                            >
                                <boxGeometry args={[0.17, 0.09, 0.25]} />
                                <meshStandardMaterial color="#ffffff" />
                            </mesh>
                        </group>
                    ))}
                </group>
            </group>

            <mesh
                position={[0, 0.48 * scale, 0]}
                onPointerDown={event => {
                    down.current = [
                        event.nativeEvent.clientX,
                        event.nativeEvent.clientY,
                    ];
                }}
                onClick={event => {
                    event.stopPropagation();

                    if (!legal || !down.current) return;

                    const dx =
                        event.nativeEvent.clientX - down.current[0];

                    const dy =
                        event.nativeEvent.clientY - down.current[1];

                    if (Math.hypot(dx, dy) < 10) {
                        onPick(piece.id);
                    }

                    down.current = null;
                }}
                onPointerOver={() => {
                    if (legal) {
                        document.body.style.cursor = 'pointer';
                    }
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                }}
            >
                <sphereGeometry
                    args={[0.4 * scale, 12, 9]}
                />
                <meshBasicMaterial
                    transparent
                    opacity={0}
                    depthWrite={false}
                />
            </mesh>
        </group>
    );
}

function CartoonDog({
    dogRef,
}: {
    dogRef: MutableRefObject<THREE.Group | null>;
}) {
    const legs = useRef<THREE.Group[]>([]);

    useFrame(({ clock }) => {
        if (!dogRef.current?.visible) return;

        legs.current.forEach((leg, i) => {
            leg.rotation.x =
                Math.sin(clock.elapsedTime * 22 + i * Math.PI) *
                0.5;
        });
    });

    return (
        <group
            ref={node => {
                dogRef.current = node;
            }}
            visible={false}
        >
            <mesh
                castShadow
                position={[0, 0.24, 0]}
                rotation={[Math.PI / 2, 0, 0]}
            >
                <capsuleGeometry args={[0.21, 0.36, 6, 10]} />
                <meshStandardMaterial color="#e7a15d" />
            </mesh>

            <mesh
                castShadow
                position={[0, 0.34, 0.34]}
            >
                <sphereGeometry args={[0.22, 12, 10]} />
                <meshStandardMaterial color="#f1bb7c" />
            </mesh>

            {[-0.14, 0.14].map(x => (
                <mesh
                    key={x}
                    castShadow
                    position={[x, 0.51, 0.34]}
                    rotation={[0, 0, x]}
                >
                    <coneGeometry args={[0.10, 0.27, 8]} />
                    <meshStandardMaterial color="#805033" />
                </mesh>
            ))}

            <mesh position={[0, 0.34, 0.55]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshStandardMaterial color="#1e2934" />
            </mesh>

            {[-0.14, 0.14].flatMap(x =>
                [-0.22, 0.22].map(z => (
                    <group
                        key={`${x}-${z}`}
                        ref={node => {
                            if (
                                node &&
                                !legs.current.includes(node)
                            ) {
                                legs.current.push(node);
                            }
                        }}
                        position={[x, 0.14, z]}
                    >
                        <mesh position={[0, -0.075, 0]}>
                            <capsuleGeometry args={[0.07, 0.13, 4, 7]} />
                            <meshStandardMaterial color="#a66b3e" />
                        </mesh>
                    </group>
                ))
            )}

            <mesh
                position={[0, 0.38, -0.41]}
                rotation={[0.8, 0, 0]}
            >
                <capsuleGeometry args={[0.055, 0.27, 4, 6]} />
                <meshStandardMaterial color="#e7a15d" />
            </mesh>
        </group>
    );
}

function CaptureEffect({
    effect,
}: {
    effect: FXState | null;
}) {
    const ring = useRef<THREE.Mesh>(null);
    const stars = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!effect) return;

        if (ring.current) {
            const pulse =
                1.15 + Math.sin(clock.elapsedTime * 12) * 0.15;

            ring.current.scale.setScalar(pulse);
        }

        if (stars.current) {
            stars.current.rotation.y += 0.04;
        }
    });

    if (!effect) return null;

    return (
        <group position={effect.position}>
            <mesh
                ref={ring}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.12, 0]}
            >
                <ringGeometry args={[0.37, 0.47, 32]} />
                <meshBasicMaterial
                    color="#ffd500"
                    side={THREE.DoubleSide}
                    toneMapped={false}
                />
            </mesh>

            <group ref={stars}>
                {Array.from({ length: 8 }, (_, i) => {
                    const angle = (i * 2 * Math.PI) / 8;

                    return (
                        <mesh
                            key={i}
                            position={[
                                Math.cos(angle) * 0.7,
                                0.95 + (i % 2) * 0.22,
                                Math.sin(angle) * 0.7,
                            ]}
                        >
                            <octahedronGeometry args={[0.14, 0]} />
                            <meshBasicMaterial
                                color={i % 2 ? '#ff4d6d' : '#ffda28'}
                                toneMapped={false}
                            />
                        </mesh>
                    );
                })}
            </group>

            <Text
                position={[0, 2.0, 0]}
                fontSize={0.53}
                color="#ffdc25"
                outlineColor="#4b2031"
                outlineWidth={0.07}
                anchorX="center"
            >
                {effect.label}
            </Text>
        </group>
    );
}

type CameraActions = MutableRefObject<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
} | null>;

function HomeCamera({
    layout,
    seat,
    actions,
}: {
    layout: BoardLayout;
    seat: number;
    actions: CameraActions;
}) {
    const { camera } = useThree();

    const target = useRef(new THREE.Vector3());
    const moving = useRef(false);

    const setSeatView = (instant: boolean) => {
        const base = layout.bases[seat];
        const direction = new THREE.Vector3(
            base[0],
            0,
            base[2]
        ).normalize();

        const distance = layout.extent * 1.4;

        target.current.set(
            direction.x * distance,
            layout.extent * 1.05,
            direction.z * distance
        );

        if (instant) {
            camera.position.copy(target.current);
            camera.lookAt(0, 0, 0);
            moving.current = false;
        } else {
            moving.current = true;
        }
    };

    useEffect(() => {
        setSeatView(true);
        // Set initial position or geometry change.
    }, [camera, layout]);

    useEffect(() => {
        setSeatView(false);
        // Smooth rotation when the chosen seat changes.
    }, [seat]);

    useEffect(() => {
        const zoom = (factor: number) => {
            const length = camera.position.length();

            const next = THREE.MathUtils.clamp(
                length * factor,
                3,
                layout.extent * 5
            );

            camera.position.multiplyScalar(next / length);
            target.current.copy(camera.position);
            moving.current = false;
        };

        actions.current = {
            zoomIn: () => zoom(0.82),
            zoomOut: () => zoom(1.22),
            resetView: () => setSeatView(false),
        };

        return () => {
            actions.current = null;
        };
    }, [actions, camera, layout, seat]);

    useFrame((_, delta) => {
        if (!moving.current) return;

        camera.position.lerp(
            target.current,
            1 - Math.exp(-delta * 3.7)
        );

        camera.lookAt(0, 0, 0);

        if (
            camera.position.distanceTo(
                target.current
            ) < 0.03
        ) {
            camera.position.copy(target.current);
            moving.current = false;
        }
    });

    return (
        <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={layout.extent * 5}
            minPolarAngle={0.16}
            maxPolarAngle={Math.PI / 2.08}
            onStart={() => {
                moving.current = false;
            }}
        />
    );
}

function AnimationDirector({
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

function World({
    game,
    validPieceIds,
    onPieceClick,
    showRoutes,
    viewSeat,
    starsPerSegment,
    jobRef,
    actors,
    dogRef,
    cameraActions,
    effect,
    setEffect,
}: Props & {
    jobRef: MutableRefObject<MoveJob | null>;
    actors: ActorRegistry;
    dogRef: MutableRefObject<THREE.Group | null>;
    cameraActions: CameraActions;
    effect: FXState | null;
    setEffect: (effect: FXState | null) => void;
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

                if (list.length > 1 && piece.progress >= 0) {
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

    const floorExtent =
        layout.mode === 'classic'
            ? 7.3
            : layout.radius + 2.05;

    return (
        <>
            <color
                attach="background"
                args={['#69cfff']}
            />

            <ambientLight intensity={0.8} />

            <hemisphereLight
                args={['#ffffff', '#3ea46a', 1.0]}
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
            />

            <mesh
                position={[0, -0.53, 0]}
                receiveShadow
                castShadow
            >
                {layout.mode === 'classic' ? (
                    <boxGeometry args={[14.7, 0.67, 14.7]} />
                ) : (
                    <cylinderGeometry
                        args={[
                            floorExtent,
                            floorExtent + 0.1,
                            0.67,
                            96,
                        ]}
                    />
                )}

                <meshStandardMaterial
                    color="#27b961"
                    roughness={0.78}
                />
            </mesh>

            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.89, 0]}
                receiveShadow
            >
                <planeGeometry args={[150, 150]} />
                <meshStandardMaterial
                    color="#f6e2b6"
                    roughness={1}
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
                            color={playerColor(seat, game.N)}
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
                        color={playerColor(seat, game.N)}
                        safe={layout.safe.has(index)}
                        start={index % game.S === 0}
                        highlighted={highlights.has(index)}
                        lane={false}
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
                        color={playerColor(seat, game.N)}
                        safe={false}
                        start={false}
                        highlighted={false}
                        lane
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

            {layout.bases.map((base, seat) => (
                <Home
                    key={`home-${seat}`}
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

            <SceneDecor layout={layout} />

            <CaptureEffect effect={effect} />

            <AnimationDirector
                game={game}
                layout={layout}
                jobRef={jobRef}
                actors={actors}
                dogRef={dogRef}
                setEffect={setEffect}
            />
        </>
    );
}

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
