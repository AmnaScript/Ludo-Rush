import * as THREE from 'three';
import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { Upright } from './Upright';

const FUR = '#e8a24f';
const FUR_LIGHT = '#f7cf93';
const FUR_DARK = '#8a4f27';

/** A big friendly (but very keen) dog. Seen from the side while it runs across the board. */
export function CartoonDog({
    dogRef,
}: {
    dogRef: MutableRefObject<THREE.Group | null>;
}) {
    const legs = useRef<THREE.Group[]>([]);
    const tail = useRef<THREE.Group>(null);
    const head = useRef<THREE.Group>(null);

    useFrame(({ clock }) => {
        if (!dogRef.current?.visible) return;
        const t = clock.elapsedTime;

        legs.current.forEach((leg, i) => {
            leg.rotation.x = Math.sin(t * 20 + (i % 2) * Math.PI) * 0.75;
        });
        if (tail.current) tail.current.rotation.x = 0.5 + Math.sin(t * 26) * 0.5;
        if (head.current) head.current.rotation.x = Math.sin(t * 10) * 0.08;
    });

    return (
        <group
            ref={node => {
                dogRef.current = node;
            }}
            visible={false}
        >
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.5, 16]} />
                <meshBasicMaterial color="#000" transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <Upright>
                <group scale={1.15}>
                    {/* body */}
                    <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <capsuleGeometry args={[0.26, 0.5, 8, 14]} />
                        <meshStandardMaterial color={FUR} roughness={0.8} />
                        <Outlines thickness={0.022} color="#1a0f08" />
                    </mesh>
                    <mesh position={[0, 0.3, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.8, 1, 0.7]}>
                        <capsuleGeometry args={[0.22, 0.42, 6, 10]} />
                        <meshStandardMaterial color={FUR_LIGHT} roughness={0.8} />
                    </mesh>

                    {/* head */}
                    <group ref={head} position={[0, 0.72, 0.46]}>
                        <mesh>
                            <sphereGeometry args={[0.3, 20, 16]} />
                            <meshStandardMaterial color={FUR} roughness={0.8} />
                            <Outlines thickness={0.022} color="#1a0f08" />
                        </mesh>
                        <mesh position={[0, -0.08, 0.26]} scale={[1, 0.8, 1]}>
                            <sphereGeometry args={[0.18, 14, 12]} />
                            <meshStandardMaterial color={FUR_LIGHT} roughness={0.8} />
                        </mesh>
                        <mesh position={[0, -0.01, 0.43]}>
                            <sphereGeometry args={[0.07, 10, 8]} />
                            <meshStandardMaterial color="#1a0f08" />
                        </mesh>
                        <mesh position={[0, -0.2, 0.34]} rotation={[0.3, 0, 0]}>
                            <capsuleGeometry args={[0.04, 0.1, 4, 8]} />
                            <meshStandardMaterial color="#ff6b8a" />
                        </mesh>
                        {[-1, 1].map(side => (
                            <group key={side}>
                                <mesh position={[side * 0.12, 0.08, 0.24]}>
                                    <sphereGeometry args={[0.07, 10, 8]} />
                                    <meshBasicMaterial color="#ffffff" />
                                </mesh>
                                <mesh position={[side * 0.12, 0.08, 0.3]}>
                                    <sphereGeometry args={[0.04, 8, 6]} />
                                    <meshBasicMaterial color="#1a0f08" />
                                </mesh>
                                <mesh position={[side * 0.27, 0.1, -0.02]} rotation={[0.2, 0, side * 0.5]}>
                                    <capsuleGeometry args={[0.09, 0.26, 4, 8]} />
                                    <meshStandardMaterial color={FUR_DARK} roughness={0.8} />
                                    <Outlines thickness={0.02} color="#1a0f08" />
                                </mesh>
                            </group>
                        ))}
                    </group>

                    {/* collar and tag */}
                    <mesh position={[0, 0.66, 0.34]} rotation={[0.9, 0, 0]}>
                        <torusGeometry args={[0.24, 0.045, 8, 20]} />
                        <meshStandardMaterial color="#e0343a" />
                    </mesh>
                    <mesh position={[0, 0.5, 0.52]}>
                        <circleGeometry args={[0.06, 12]} />
                        <meshBasicMaterial color="#ffb800" />
                    </mesh>

                    {/* tail */}
                    <group ref={tail} position={[0, 0.55, -0.5]}>
                        <mesh position={[0, 0.17, -0.02]} rotation={[-0.4, 0, 0]}>
                            <capsuleGeometry args={[0.065, 0.32, 4, 8]} />
                            <meshStandardMaterial color={FUR} roughness={0.8} />
                            <Outlines thickness={0.018} color="#1a0f08" />
                        </mesh>
                    </group>

                    {/* legs */}
                    {[-0.15, 0.15].flatMap(x =>
                        [-0.3, 0.3].map(z => (
                            <group
                                key={`${x}-${z}`}
                                ref={node => {
                                    if (node && !legs.current.includes(node)) {
                                        legs.current.push(node);
                                    }
                                }}
                                position={[x, 0.26, z]}
                            >
                                <mesh position={[0, -0.12, 0]}>
                                    <capsuleGeometry args={[0.07, 0.16, 4, 8]} />
                                    <meshStandardMaterial color={FUR_DARK} roughness={0.8} />
                                    <Outlines thickness={0.018} color="#1a0f08" />
                                </mesh>
                            </group>
                        ))
                    )}
                </group>
            </Upright>
        </group>
    );
}
