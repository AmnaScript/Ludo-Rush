import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { Upright, WorldCounter } from './Upright';
import { type GameState, type Piece } from '@ludo-rush/shared';
import { playerColor, type Vec3 } from '../boardLayout';
import { type ActorRegistry } from './types';
import { place } from './helpers';

const SKINS = ['#f6c7a1', '#e7a77c', '#c98b5e', '#9c6440', '#6f4529'];
const HAIRS = ['#2b2230', '#4a2f22', '#7a4b25', '#d7a84a', '#b23a2e', '#3a3f55'];

/** Stable per-character look: skin, hair colour and hair style (short, cap, ponytail, bun). */
function characterLook(seat: number, index: number) {
    const skin = SKINS[(seat * 2 + index * 3) % SKINS.length]!;
    return {
        skin,
        skinDark: '#' + new THREE.Color(skin).multiplyScalar(0.82).getHexString(),
        hair: HAIRS[(seat + index * 2) % HAIRS.length]!,
        style: (seat + index) % 4,
    };
}

export function Character({
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
    const ring = useRef<THREE.Mesh>(null);
    const chevron = useRef<THREE.Group>(null);

    const down = useRef<[number, number] | null>(null);

    const color = playerColor(
        piece.ownerSeat,
        game.N
    );

    const done = piece.progress >= game.L + game.H;
    const scale = (compact ? 0.7 : 1.0) * (done ? 0.7 : 1);

    const look = useMemo(
        () => characterLook(piece.ownerSeat, Number(piece.id.split('-p')[1] ?? 0)),
        [piece.id, piece.ownerSeat]
    );
    const trim = useMemo(
        () => '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.6).getHexString(),
        [color]
    );

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

        if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 6) * 0.12);
        if (chevron.current) chevron.current.position.y = 1.78 + Math.abs(Math.sin(t * 5)) * 0.14;

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
            <WorldCounter>
            <mesh position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.34 * scale, 20]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
            </mesh>
            {legal && (
                <mesh ref={ring} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.46 * scale, 0.62 * scale, 32]} />
                    <meshBasicMaterial color="#ffb800" side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
            )}

            </WorldCounter>

            <Upright>
            <group scale={scale}>
                <group ref={body}>
                    {/* torso: shirt, collar and belt */}
                    <mesh position={[0, 0.61, 0]}>
                        <capsuleGeometry args={[0.2, 0.28, 8, 16]} />
                        <meshStandardMaterial color={color} roughness={0.55} />
                        <Outlines thickness={0.022} color="#1a0f08" />
                    </mesh>
                    <mesh position={[0, 0.84, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.125, 0.032, 8, 18]} />
                        <meshStandardMaterial color={trim} roughness={0.5} />
                    </mesh>
                    <mesh position={[0, 0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.2, 0.026, 8, 20]} />
                        <meshStandardMaterial color="#2a2f3d" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0.62, 0.195]}>
                        <circleGeometry args={[0.065, 14]} />
                        <meshBasicMaterial color={trim} />
                    </mesh>

                    <group position={[0, -0.27, 0]} scale={1.25}>
                    {/* head */}
                    <mesh position={[0, 1.08, 0]} scale={[1, 1.02, 0.97]}>
                        <sphereGeometry args={[0.27, 24, 18]} />
                        <meshStandardMaterial color={look.skin} roughness={0.7} />
                        <Outlines thickness={0.02} color="#1a0f08" />
                    </mesh>
                    {[-1, 1].map(side => (
                        <mesh key={`ear-${side}`} position={[side * 0.265, 1.07, 0]}>
                            <sphereGeometry args={[0.05, 10, 8]} />
                            <meshStandardMaterial color={look.skin} roughness={0.7} />
                        </mesh>
                    ))}

                    {/* face */}
                    {[-1, 1].map(side => (
                        <group key={`eye-${side}`} position={[side * 0.098, 1.105, 0.222]}>
                            <mesh scale={[1, 1.15, 0.5]}>
                                <sphereGeometry args={[0.056, 14, 12]} />
                                <meshBasicMaterial color="#ffffff" />
                            </mesh>
                            <mesh position={[0, -0.004, 0.022]}>
                                <sphereGeometry args={[0.034, 12, 10]} />
                                <meshBasicMaterial color="#1b2430" />
                            </mesh>
                            <mesh position={[0.011, 0.014, 0.05]}>
                                <sphereGeometry args={[0.011, 8, 6]} />
                                <meshBasicMaterial color="#ffffff" />
                            </mesh>
                            <mesh position={[0, 0.08, 0.012]} rotation={[0, 0, side * -0.18]}>
                                <boxGeometry args={[0.075, 0.016, 0.014]} />
                                <meshBasicMaterial color={look.hair} />
                            </mesh>
                        </group>
                    ))}
                    <mesh position={[0, 1.045, 0.262]}>
                        <sphereGeometry args={[0.026, 8, 8]} />
                        <meshStandardMaterial color={look.skinDark} roughness={0.7} />
                    </mesh>
                    <mesh position={[0, 0.985, 0.252]} rotation={[0, 0, Math.PI]}>
                        <torusGeometry args={[0.062, 0.011, 6, 14, Math.PI]} />
                        <meshBasicMaterial color="#7a2f3a" />
                    </mesh>
                    {[-1, 1].map(side => (
                        <mesh key={`cheek-${side}`} position={[side * 0.16, 1.0, 0.2]} scale={[1, 0.7, 0.4]}>
                            <sphereGeometry args={[0.04, 8, 8]} />
                            <meshBasicMaterial color="#ff8f9b" transparent opacity={0.55} />
                        </mesh>
                    ))}

                    {/* hair or cap */}
                    <mesh position={[0, 1.1, -0.025]} rotation={[-0.42, 0, 0]}>
                        <sphereGeometry args={[0.292, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
                        <meshStandardMaterial color={look.style === 1 ? color : look.hair} roughness={0.65} />
                    </mesh>
                    {look.style === 1 && (
                        <mesh position={[0, 1.24, 0.27]} rotation={[0.2, 0, 0]}>
                            <boxGeometry args={[0.3, 0.025, 0.2]} />
                            <meshStandardMaterial color={trim} roughness={0.55} />
                        </mesh>
                    )}
                    {look.style === 2 && (
                        <group position={[0, 1.08, -0.3]}>
                            <mesh>
                                <sphereGeometry args={[0.095, 12, 10]} />
                                <meshStandardMaterial color={look.hair} roughness={0.65} />
                            </mesh>
                            <mesh position={[0, -0.13, -0.03]}>
                                <capsuleGeometry args={[0.05, 0.14, 5, 8]} />
                                <meshStandardMaterial color={look.hair} roughness={0.65} />
                            </mesh>
                        </group>
                    )}
                    {look.style === 3 && (
                        <mesh position={[0, 1.4, -0.04]}>
                            <sphereGeometry args={[0.115, 14, 12]} />
                            <meshStandardMaterial color={look.hair} roughness={0.65} />
                        </mesh>
                    )}

                    </group>

                    {/* arms */}
                    {([armL, armR] as const).map((armRef, index) => (
                        <group
                            key={index}
                            ref={armRef}
                            position={[index === 0 ? -0.27 : 0.27, 0.8, 0]}
                        >
                            <mesh position={[0, -0.1, 0]}>
                                <capsuleGeometry args={[0.088, 0.1, 6, 10]} />
                                <meshStandardMaterial color={color} roughness={0.55} />
                            </mesh>
                            <mesh position={[0, -0.27, 0]}>
                                <capsuleGeometry args={[0.064, 0.12, 5, 8]} />
                                <meshStandardMaterial color={look.skin} roughness={0.7} />
                            </mesh>
                            <mesh position={[0, -0.39, 0]}>
                                <sphereGeometry args={[0.078, 12, 10]} />
                                <meshStandardMaterial color={look.skin} roughness={0.7} />
                            </mesh>

                            {index === 1 && (
                                <group ref={gun} visible={false} position={[0, -0.42, 0]}>
                                    {/* barrel runs along the arm, away from the hand */}
                                    <mesh position={[0, -0.2, 0]}>
                                        <boxGeometry args={[0.14, 0.44, 0.15]} />
                                        <meshStandardMaterial color="#4a5866" metalness={0.5} roughness={0.4} />
                                        <Outlines thickness={0.02} color="#1a0f08" />
                                    </mesh>
                                    <mesh position={[0, -0.02, -0.15]}>
                                        <boxGeometry args={[0.12, 0.16, 0.2]} />
                                        <meshStandardMaterial color="#2a3340" />
                                        <Outlines thickness={0.02} color="#1a0f08" />
                                    </mesh>
                                    <mesh
                                        ref={flash}
                                        visible={false}
                                        position={[0, -0.58, 0]}
                                        rotation={[Math.PI, 0, 0]}
                                    >
                                        <coneGeometry args={[0.16, 0.36, 7]} />
                                        <meshBasicMaterial color="#fff22e" toneMapped={false} />
                                    </mesh>
                                </group>
                            )}
                        </group>
                    ))}

                    {/* legs and shoes */}
                    {[-0.11, 0.11].map((x, index) => (
                        <group key={index} ref={index === 0 ? legL : legR} position={[x, 0.36, 0]}>
                            <mesh position={[0, -0.15, 0]}>
                                <capsuleGeometry args={[0.092, 0.2, 6, 10]} />
                                <meshStandardMaterial color="#2b3a55" roughness={0.65} />
                            </mesh>
                            <mesh position={[0, -0.33, 0.06]}>
                                <capsuleGeometry args={[0.085, 0.12, 5, 10]} />
                                <meshStandardMaterial color="#fbfbfb" roughness={0.5} />
                            </mesh>
                            <mesh position={[0, -0.395, 0.06]}>
                                <boxGeometry args={[0.18, 0.03, 0.3]} />
                                <meshStandardMaterial color={trim} roughness={0.6} />
                            </mesh>
                        </group>
                    ))}
                </group>
            </group>

            {legal && (
                <group ref={chevron} position={[0, 1.78, 0]} scale={scale}>
                    <mesh rotation={[0, 0, Math.PI]}>
                        <coneGeometry args={[0.2, 0.3, 3]} />
                        <meshBasicMaterial color="#ffb800" toneMapped={false} />
                    </mesh>
                </group>
            )}

            <mesh
                position={[0, 0.7 * scale, 0]}
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
            </Upright>
        </group>
    );
}
