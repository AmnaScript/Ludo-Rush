import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { type FXState } from './types';
import { GAME_FONT } from './constants';

export function CaptureEffect({
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
                font={GAME_FONT}
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
