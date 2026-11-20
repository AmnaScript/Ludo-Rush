import * as THREE from 'three';
import { RoundedBox, Text } from '@react-three/drei';
import { type Vec3 } from '../boardLayout';
import { GAME_FONT } from './constants';

export function Tile({
    position,
    size,
    color,
    start,
    safe,
    highlighted,
    lane,
    arrow,
    rotation = 0,
}: {
    position: Vec3;
    size: number;
    color: string;
    start: boolean;
    safe: boolean;
    highlighted: boolean;
    lane: boolean;
    arrow: number | null;
    rotation?: number;
}) {
    const fill = highlighted
        ? '#ffe864'
        : lane || start
            ? color
            : '#fffaf0';

    return (
        <group position={position}>
            <group rotation={[0, rotation, 0]}>
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
                                : '#efe1bd'
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
            </group>

            {(safe || start) && !lane && (
                <Text
                font={GAME_FONT}
                    position={[0, 0.218, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={size * 0.4}
                    color={start ? '#2b1a12' : '#e4a323'}
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
