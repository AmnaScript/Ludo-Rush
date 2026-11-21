import * as THREE from 'three';
import { useMemo } from 'react';
import { RoundedBox, Text } from '@react-three/drei';
import { type Vec3 } from '../boardLayout';
import { GAME_FONT } from './constants';
import { Flat } from './Upright';
import { screen } from './screen';

/** A flat, painted starting yard: one parking spot per character and the player's name on top. */
export function Home({
    base,
    slots,
    color,
    seat,
    active,
    compact,
    label,
}: {
    base: Vec3;
    slots: Vec3[];
    color: string;
    seat: number;
    active: boolean;
    compact: boolean;
    label?: string;
}) {
    const light = useMemo(() => '#' + new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.42).getHexString(), [color]);
    const dark = useMemo(() => '#' + new THREE.Color(color).multiplyScalar(0.72).getHexString(), [color]);
    const panel = compact ? 2.2 : 3.9;

    return (
        <group position={base}>
            {active && (
                <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[5.65, 5.65]} />
                    <meshBasicMaterial color="#ffb800" toneMapped={false} />
                </mesh>
            )}

            <RoundedBox args={[panel, 0.05, panel]} radius={0.25} smoothness={3} position={[0, -0.11, 0]} receiveShadow>
                <meshStandardMaterial color={light} roughness={0.8} />
            </RoundedBox>

            {slots.map((slot, i) => (
                <group key={i} position={[slot[0] - base[0], 0, slot[2] - base[2]]}>
                    <mesh position={[0, -0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <circleGeometry args={[0.55, 28]} />
                        <meshBasicMaterial color={dark} />
                    </mesh>
                    <mesh position={[0, -0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <circleGeometry args={[0.43, 28]} />
                        <meshBasicMaterial color={color} />
                    </mesh>
                </group>
            ))}

            <group position={[screen.up.x * 2.25, 0, screen.up.z * 2.25]}>
                <Flat y={0.4}>
                    <Text
                        font={GAME_FONT}
                        fontSize={compact ? 0.3 : 0.42}
                        color="#ffffff"
                        outlineColor="#1a0f08"
                        outlineWidth={0.06}
                        anchorX="center"
                        anchorY="middle"
                    >
                        {label ?? `P${seat + 1}`}
                    </Text>
                </Flat>
            </group>
        </group>
    );
}
