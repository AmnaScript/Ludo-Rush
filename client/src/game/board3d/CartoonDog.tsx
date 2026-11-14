import * as THREE from 'three';
import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';

export function CartoonDog({
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
