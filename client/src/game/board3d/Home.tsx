import * as THREE from 'three';
import { Billboard, RoundedBox, Text } from '@react-three/drei';
import { type Vec3 } from '../boardLayout';
import { GAME_FONT } from './constants';

export function Home({
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

            <Billboard position={[0, size * 1.58, 0]}>
            <Text
                font={GAME_FONT}
                fontSize={compact ? 0.24 : 0.35}
                color={color}
                outlineColor="#243040"
                outlineWidth={0.028}
            >
                P{seat + 1}
            </Text>
            </Billboard>

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
