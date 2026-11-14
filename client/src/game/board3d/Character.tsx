import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type GameState, type Piece } from '@ludo-rush/shared';
import { playerColor, type Vec3 } from '../boardLayout';
import { type ActorRegistry } from './types';
import { place } from './helpers';

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
