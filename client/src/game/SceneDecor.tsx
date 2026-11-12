
import { useMemo } from 'react';
import type { BoardLayout } from './boardLayout';

interface Props {
    layout: BoardLayout;
}

const FLOWER_COLORS = [
    '#ff3a86',
    '#ffbe0b',
    '#fb5607',
    '#8338ec',
    '#ffffff',
];

function PineTree({
    x,
    z,
    scale,
    hue,
}: {
    x: number;
    z: number;
    scale: number;
    hue: number;
}) {
    return (
        <group position={[x, -0.12, z]} scale={scale}>
            <mesh castShadow position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.1, 0.15, 0.7, 7]} />
                <meshStandardMaterial color="#9c663a" />
            </mesh>

            <mesh castShadow position={[0, 0.84, 0]}>
                <coneGeometry args={[0.58, 1.02, 9]} />
                <meshStandardMaterial
                    color={hue % 2 === 0 ? '#098b46' : '#0dbd5a'}
                    roughness={0.9}
                />
            </mesh>

            <mesh castShadow position={[0, 1.32, 0]}>
                <coneGeometry args={[0.41, 0.84, 9]} />
                <meshStandardMaterial color="#48dd77" />
            </mesh>

            <mesh castShadow position={[0, 1.7, 0]}>
                <coneGeometry args={[0.24, 0.54, 9]} />
                <meshStandardMaterial color="#a3f18b" />
            </mesh>
        </group>
    );
}

function Flower({
    x,
    z,
    color,
}: {
    x: number;
    z: number;
    color: string;
}) {
    return (
        <group position={[x, -0.06, z]}>
            <mesh position={[0, 0.13, 0]}>
                <cylinderGeometry args={[0.015, 0.025, 0.26, 5]} />
                <meshStandardMaterial color="#177c36" />
            </mesh>

            <mesh position={[0, 0.29, 0]}>
                <sphereGeometry args={[0.085, 7, 6]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.1}
                />
            </mesh>

            <mesh position={[0, 0.32, 0.065]}>
                <sphereGeometry args={[0.033, 6, 6]} />
                <meshBasicMaterial color="#ffe56e" />
            </mesh>
        </group>
    );
}

function Rock({
    x,
    z,
    scale,
}: {
    x: number;
    z: number;
    scale: number;
}) {
    return (
        <mesh
            position={[x, -0.04, z]}
            rotation={[0, x * 0.3, 0.16]}
            scale={[scale, scale * 0.65, scale * 0.9]}
            castShadow
        >
            <dodecahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial
                color="#f6e5be"
                roughness={1}
            />
        </mesh>
    );
}

export function SceneDecor({ layout }: Props) {
    const positions = useMemo(() => {
        const distance =
            layout.mode === 'classic'
                ? 9.0
                : layout.radius + 3.0;

        return Array.from({ length: 20 }, (_, i) => {
            const angle = (i * 2 * Math.PI) / 20;

            return {
                x: Math.cos(angle) * distance,
                z: Math.sin(angle) * distance,
                scale: 0.55 + (i % 4) * 0.13,
                hue: i,
            };
        });
    }, [layout.mode, layout.radius]);

    const flowers = useMemo(() => {
        const distance =
            layout.mode === 'classic'
                ? 8.2
                : layout.radius + 2.35;

        return Array.from({ length: 64 }, (_, i) => {
            const angle = (i * 2 * Math.PI) / 64;
            const jitter = ((i * 7) % 5) * 0.13;

            return {
                x: Math.cos(angle) * (distance + jitter),
                z: Math.sin(angle) * (distance + jitter),
                color: FLOWER_COLORS[i % FLOWER_COLORS.length],
            };
        });
    }, [layout.mode, layout.radius]);

    return (
        <group>
            {positions.map((item, index) => (
                <PineTree key={index} {...item} />
            ))}

            {flowers.map((item, index) => (
                <Flower key={index} {...item} />
            ))}

            {positions
                .filter((_, i) => i % 3 === 0)
                .map((item, index) => (
                    <Rock
                        key={index}
                        x={item.x * 0.96}
                        z={item.z * 0.96}
                        scale={0.6 + index * 0.06}
                    />
                ))}
        </group>
    );
}
