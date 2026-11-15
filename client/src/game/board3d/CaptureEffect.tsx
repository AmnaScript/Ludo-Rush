import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { type FXState } from './types';
import { GAME_FONT } from './constants';

const mat = (color: string) => (
    <meshBasicMaterial color={color} toneMapped={false} transparent />
);

function Burst({ refGroup, color = '#ffe14a', spikes = 10, size = 0.5 }: { refGroup: React.RefObject<THREE.Group | null>; color?: string; spikes?: number; size?: number }) {
    return (
        <group ref={refGroup as React.Ref<THREE.Group>} visible={false}>
            {Array.from({ length: spikes }, (_, i) => {
                const a = (i / spikes) * Math.PI * 2;
                return (
                    <mesh key={i} position={[Math.cos(a) * size, Math.sin(a) * size, 0]} rotation={[0, 0, a - Math.PI / 2]}>
                        <coneGeometry args={[size * 0.28, size * 1.1, 4]} />
                        {mat(i % 2 ? color : '#ffffff')}
                    </mesh>
                );
            })}
            <mesh>
                <circleGeometry args={[size * 0.75, 20]} />
                {mat(color)}
            </mesh>
        </group>
    );
}

/** Everything is timed against effect.duration so the scene matches the animation. */
export function CaptureEffect({ effect }: { effect: FXState | null }) {
    const start = useRef(0);
    const clockRef = useRef<THREE.Clock | null>(null);

    const flash = useRef<THREE.Mesh>(null);
    const bullet = useRef<THREE.Mesh>(null);
    const tracer = useRef<THREE.Mesh>(null);
    const burst = useRef<THREE.Group>(null);
    const shock = useRef<THREE.Mesh>(null);
    const stars = useRef<THREE.Group>(null);
    const word = useRef<THREE.Group>(null);
    const lock = useRef<THREE.Group>(null);
    const ring = useRef<THREE.Mesh>(null);

    useEffect(() => {
        start.current = clockRef.current ? clockRef.current.elapsedTime : 0;
    }, [effect]);

    useFrame(({ clock, camera }) => {
        clockRef.current = clock;
        if (!effect) return;
        const tt = Math.min((clock.elapsedTime - start.current) / effect.duration, 1);
        const A = effect.attackerPos;
        const V = effect.victimPos;
        const chest = (p: [number, number, number]) => new THREE.Vector3(p[0], 0.75, p[2]);

        // floating comic word always faces the camera and bobs
        if (word.current) {
            word.current.quaternion.copy(camera.quaternion);
            const pop = 1 + Math.max(0, 0.35 - tt) * 2.2;
            word.current.scale.setScalar(pop);
        }
        if (ring.current) ring.current.scale.setScalar(1.1 + Math.sin(clock.elapsedTime * 12) * 0.15);
        if (stars.current) stars.current.rotation.y += 0.09;

        if (effect.style === 'GUN') {
            const a = new THREE.Vector3(A[0], 0.8, A[2]);
            const v = chest(V);
            const dir = v.clone().sub(a);
            const len = dir.length();
            const dirN = dir.clone().normalize();
            const muzzle = a.clone().add(dirN.clone().multiplyScalar(0.55));

            if (flash.current) {
                flash.current.visible = tt > 0.14 && tt < 0.3;
                flash.current.position.copy(muzzle);
                flash.current.scale.setScalar(1 + (tt - 0.14) * 6);
            }
            if (bullet.current) {
                const f = THREE.MathUtils.clamp((tt - 0.2) / 0.12, 0, 1);
                bullet.current.visible = tt > 0.2 && tt < 0.34;
                bullet.current.position.copy(muzzle).lerp(v, f);
            }
            if (tracer.current) {
                tracer.current.visible = tt > 0.2 && tt < 0.42;
                tracer.current.position.copy(a.clone().add(v).multiplyScalar(0.5));
                tracer.current.scale.set(1, Math.max(0.01, len - 0.5), 1);
                tracer.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirN);
                const m = tracer.current.material as THREE.MeshBasicMaterial;
                m.opacity = THREE.MathUtils.clamp(1 - (tt - 0.2) / 0.22, 0, 1);
            }
            if (burst.current) {
                burst.current.visible = tt > 0.3 && tt < 0.56;
                burst.current.position.copy(v).add(new THREE.Vector3(0, 0.25, 0));
                burst.current.quaternion.copy(camera.quaternion);
                burst.current.scale.setScalar(0.6 + (tt - 0.3) * 6);
            }
        }

        if (effect.style === 'SLAP') {
            const head = new THREE.Vector3(V[0], 1.05, V[2]);
            if (burst.current) {
                burst.current.visible = tt > 0.15 && tt < 0.5;
                burst.current.position.copy(head).add(new THREE.Vector3(0, 0.1, 0));
                burst.current.quaternion.copy(camera.quaternion);
                burst.current.scale.setScalar(0.7 + (tt - 0.15) * 4);
            }
            if (shock.current) {
                const f = THREE.MathUtils.clamp((tt - 0.15) / 0.3, 0, 1);
                shock.current.visible = f > 0 && f < 1;
                shock.current.position.set(V[0], 0.15, V[2]);
                shock.current.scale.setScalar(0.3 + f * 3.2);
                (shock.current.material as THREE.MeshBasicMaterial).opacity = 1 - f;
            }
            if (stars.current) {
                stars.current.visible = tt > 0.2 && tt < 0.7;
                stars.current.position.set(V[0], 1.55, V[2]);
            }
        }

        if (effect.style === 'DOG') {
            if (lock.current) {
                const f = THREE.MathUtils.clamp((tt - 0.86) / 0.08, 0, 1);
                lock.current.visible = tt > 0.86;
                lock.current.position.set(effect.homePos[0], 1.7, effect.homePos[2]);
                lock.current.quaternion.copy(camera.quaternion);
                lock.current.scale.setScalar(0.4 + f * 1.1);
            }
            if (burst.current) {
                burst.current.visible = tt > 0.86 && tt < 0.97;
                burst.current.position.set(effect.homePos[0], 1.0, effect.homePos[2]);
                burst.current.quaternion.copy(camera.quaternion);
                burst.current.scale.setScalar(1.0);
            }
        }
    });

    if (!effect) return null;

    const wordPos: [number, number, number] =
        effect.style === 'DOG'
            ? [effect.attackerPos[0], 2.5, effect.attackerPos[2]]
            : [effect.victimPos[0], 2.6, effect.victimPos[2]];

    return (
        <group>
            {/* spotlight ring under the attacker and the victim */}
            <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[effect.attackerPos[0], 0.12, effect.attackerPos[2]]}>
                <ringGeometry args={[0.42, 0.56, 32]} />
                {mat('#2bff88')}
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[effect.victimPos[0], 0.12, effect.victimPos[2]]}>
                <ringGeometry args={[0.42, 0.56, 32]} />
                {mat('#ff3b5c')}
            </mesh>

            <group ref={word} position={wordPos}>
                <Text font={GAME_FONT} fontSize={0.6} color="#ffe14a" outlineColor="#4b1330" outlineWidth={0.1} anchorX="center">
                    {effect.label}
                </Text>
            </group>

            {effect.style === 'GUN' && (
                <>
                    <mesh ref={flash} visible={false}>
                        <sphereGeometry args={[0.32, 12, 10]} />
                        {mat('#fff3a0')}
                    </mesh>
                    <mesh ref={bullet} visible={false}>
                        <sphereGeometry args={[0.12, 10, 8]} />
                        {mat('#ffffff')}
                    </mesh>
                    <mesh ref={tracer} visible={false}>
                        <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
                        {mat('#ffd23a')}
                    </mesh>
                    <Burst refGroup={burst} color="#ff6a3d" spikes={12} size={0.55} />
                </>
            )}

            {effect.style === 'SLAP' && (
                <>
                    <Burst refGroup={burst} color="#ffe14a" spikes={10} size={0.5} />
                    <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
                        <ringGeometry args={[0.8, 1, 40]} />
                        {mat('#ffffff')}
                    </mesh>
                    <group ref={stars} visible={false}>
                        {Array.from({ length: 6 }, (_, i) => {
                            const a = (i * Math.PI * 2) / 6;
                            return (
                                <mesh key={i} position={[Math.cos(a) * 0.55, (i % 2) * 0.18, Math.sin(a) * 0.55]}>
                                    <octahedronGeometry args={[0.16, 0]} />
                                    {mat(i % 2 ? '#ff4d6d' : '#ffe14a')}
                                </mesh>
                            );
                        })}
                    </group>
                </>
            )}

            {effect.style === 'DOG' && (
                <>
                    <Burst refGroup={burst} color="#ffd23a" spikes={10} size={0.7} />
                    <group ref={lock} visible={false}>
                        <mesh position={[0, -0.1, 0]}>
                            <boxGeometry args={[0.7, 0.55, 0.25]} />
                            {mat('#ffc928')}
                        </mesh>
                        <mesh position={[0, 0.3, 0]}>
                            <torusGeometry args={[0.22, 0.07, 8, 16, Math.PI]} />
                            {mat('#b8c0c8')}
                        </mesh>
                        <mesh position={[0, -0.1, 0.14]}>
                            <circleGeometry args={[0.09, 12]} />
                            {mat('#4b1330')}
                        </mesh>
                    </group>
                </>
            )}
        </group>
    );
}
