import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { type ActorRegistry, type FXState } from './types';
import { GAME_FONT } from './constants';
import { Flat } from './Upright';
import { counterScale, screen } from './screen';
import { timeScale } from './helpers';
import { SCENE, ramp } from './scenes';

const basic = (c: string, extra?: { opacity?: number }) => (
    <meshBasicMaterial color={c} toneMapped={false} transparent={extra?.opacity !== undefined} opacity={extra?.opacity ?? 1} depthWrite={false} />
);

function starShape(points: number, outer: number, inner: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
}

/** A spiky comic starburst. */
function Burst({ g, color, size }: { g: (n: THREE.Group | null) => void; color: string; size: number }) {
    const outer = useMemo(() => new THREE.ShapeGeometry(starShape(11, size, size * 0.55)), [size]);
    const inner = useMemo(() => new THREE.ShapeGeometry(starShape(11, size * 0.7, size * 0.36)), [size]);
    return (
        <Flat gref={g}>
            <mesh geometry={outer} position={[0, 0, 0]}>{basic('#1a0f08')}</mesh>
            <mesh geometry={inner} position={[0, 0, 0.01]}>{basic(color)}</mesh>
            <mesh geometry={inner} position={[0, 0, 0.02]} scale={0.55}>{basic('#ffffff')}</mesh>
        </Flat>
    );
}

function Word({ g, text, color, size = 0.95 }: { g: (n: THREE.Group | null) => void; text: string; color: string; size?: number }) {
    return (
        <Flat gref={g}>
            <Text font={GAME_FONT} fontSize={size} color={color} outlineColor="#1a0f08" outlineWidth={0.1} anchorX="center" anchorY="middle" rotation={[0, 0, 0.1]}>
                {text}
            </Text>
        </Flat>
    );
}

/** Scene actors are drawn this much bigger than normal pieces. */
const K = 1.2;

export function CaptureEffect({ effect, actors }: { effect: FXState | null; actors: ActorRegistry }) {
    const acc = useRef(0);

    const ringA = useRef<THREE.Mesh>(null);
    const ringV = useRef<THREE.Mesh>(null);
    const word = useRef<THREE.Group | null>(null);
    const word2 = useRef<THREE.Group | null>(null);
    const burst = useRef<THREE.Group | null>(null);
    const flash = useRef<THREE.Group | null>(null);
    const swoosh = useRef<THREE.Group | null>(null);
    const hand = useRef<THREE.Group | null>(null);
    const stars = useRef<THREE.Group | null>(null);
    const bullet = useRef<THREE.Group | null>(null);
    const smoke = useRef<THREE.Group | null>(null);
    const whistle = useRef<THREE.Group | null>(null);
    const waves = useRef<THREE.Group | null>(null);
    const lock = useRef<THREE.Group | null>(null);
    const warn = useRef<THREE.Group | null>(null);

    const gref = (r: React.MutableRefObject<THREE.Group | null>) => (n: THREE.Group | null) => {
        r.current = n;
    };

    const starGeo = useMemo(() => new THREE.ShapeGeometry(starShape(5, 0.2, 0.09)), []);
    const warnGeo = useMemo(() => {
        const s = new THREE.Shape();
        s.moveTo(0, 0.5);
        s.lineTo(0.46, -0.3);
        s.lineTo(-0.46, -0.3);
        s.closePath();
        return new THREE.ShapeGeometry(s);
    }, []);

    useEffect(() => {
        acc.current = 0;
    }, [effect]);

    useFrame(({ clock: c }, deltaRaw) => {
        acc.current += Math.min(deltaRaw, 0.06) * timeScale();
        const all = [word, word2, burst, flash, swoosh, hand, stars, bullet, smoke, whistle, waves, lock, warn];
        const vis = (r: React.MutableRefObject<THREE.Group | null>, on: boolean) => {
            if (r.current) r.current.visible = on;
        };

        if (!effect) {
            all.forEach(r => vis(r, false));
            if (ringA.current) ringA.current.visible = false;
            if (ringV.current) ringV.current.visible = false;
            return;
        }

        const t = Math.min(acc.current / effect.duration, 1);
        const a = actors.current.get(effect.attackerId)?.root.position;
        const v = actors.current.get(effect.victimId)?.root.position;
        if (!a || !v) return;

        const R = screen.right;
        const U = screen.up;
        const put = (g: THREE.Object3D | null, p: THREE.Vector3, dx: number, h: number) => {
            if (!g) return;
            const dxs = (dx * K) / screen.stretch; // offsets are screen distances, the board is stretched
            g.position.x = p.x + R.x * dxs + U.x * h * K;
            g.position.z = p.z + R.z * dxs + U.z * h * K;
        };
        const mid = new THREE.Vector3().addVectors(a, v).multiplyScalar(0.5);
        const side = (v.x - a.x) * R.x + (v.z - a.z) * R.z >= 0 ? 1 : -1; // attacker -> victim, on screen
        const pop = (g: THREE.Group | null, k: number, fadeStart: number, fadeEnd: number, base = 1) => {
            if (!g) return;
            const out = 1 - ramp(k, fadeStart, fadeEnd);
            const overshoot = 1 + Math.sin(Math.min(1, ramp(k, 0, 0.12)) * Math.PI) * 0.35;
            g.scale.setScalar(Math.max(0.001, base * overshoot * out));
        };

        // spotlight rings under the two actors
        if (ringA.current) {
            ringA.current.visible = effect.style !== 'PENALTY';
            ringA.current.position.set(a.x, 0.32, a.z);
            { const [cx, , cz] = counterScale(); const k = 1 + Math.sin(c.elapsedTime * 8) * 0.06; ringA.current.scale.set(cx * k, cz * k, k); }
        }
        if (ringV.current) {
            ringV.current.visible = true;
            ringV.current.position.set(v.x, 0.32, v.z);
            { const [cx, , cz] = counterScale(); const k = 1 + Math.sin(c.elapsedTime * 8 + 1) * 0.06; ringV.current.scale.set(cx * k, cz * k, k); }
        }

        all.forEach(r => vis(r, false));

        // orbiting stars over the victim's head
        const orbit = (from: number, to: number) => {
            if (!stars.current || t < from || t > to) return;
            stars.current.visible = true;
            put(stars.current, v, 0, 2.1);
            stars.current.children.forEach((child, i) => {
                const ang = c.elapsedTime * 7 + (i / 5) * Math.PI * 2;
                child.position.set(Math.cos(ang) * 0.62, Math.sin(ang) * 0.16, 0.05 + Math.sin(ang) * 0.02);
                child.rotation.z = c.elapsedTime * 4;
            });
        };

        if (effect.style === 'SLAP') {
            const hit = SCENE.SLAP.hit;
            const k = t - hit;
            // the swipe: a big white arc from the attacker's hand across the victim's face
            if (t > hit - 0.09 && t < hit + 0.07) {
                vis(swoosh, true);
                put(swoosh.current, mid, 0, 1.2);
                if (swoosh.current) {
                    swoosh.current.scale.set(side * (0.6 + ramp(t, hit - 0.09, hit) * 0.7), 0.9, 1);
                }
            }
            if (t >= hit && t < hit + 0.14) {
                vis(burst, true);
                put(burst.current, v, -side * 0.2, 1.25);
                if (burst.current) burst.current.scale.setScalar(0.5 + ramp(t, hit, hit + 0.05) * 1.1);
            }
            if (t >= hit && t < hit + 0.5) {
                vis(hand, true);
                put(hand.current, v, -side * 0.28, 1.2);
                if (hand.current) hand.current.scale.set(-side * 1.2, 1.2, 1);
            }
            if (t >= hit) {
                vis(word, true);
                put(word.current, mid, 0, 3.0);
                pop(word.current, k / 0.6, 0.55, 1, 1.15);
            }
            orbit(hit + 0.02, hit + 0.5);
        }

        if (effect.style === 'GUN') {
            const { fire, hit } = SCENE.GUN;
            const tip = new THREE.Vector3(a.x, 0, a.z);
            const tipDx = side * 1.55;
            const tipH = 1.22;
            const chest = new THREE.Vector3(v.x, 0, v.z);

            if (t >= fire && t < fire + 0.07) {
                vis(flash, true);
                put(flash.current, tip, tipDx, tipH);
                if (flash.current) flash.current.scale.setScalar(0.7 + ramp(t, fire, fire + 0.03) * 0.6);
            }
            if (t >= fire && t < fire + 0.3) {
                vis(smoke, true);
                put(smoke.current, tip, tipDx + side * 0.25 * ramp(t, fire, fire + 0.3), tipH + 0.25 * ramp(t, fire, fire + 0.3));
                if (smoke.current) smoke.current.scale.setScalar(0.6 + ramp(t, fire, fire + 0.3) * 1.4);
            }
            if (t >= fire && t < hit) {
                const k = ramp(t, fire, hit);
                vis(bullet, true);
                const bx = tip.x + (chest.x - tip.x) * k;
                const bz = tip.z + (chest.z - tip.z) * k;
                put(bullet.current, new THREE.Vector3(bx, 0, bz), tipDx * (1 - k), tipH + (1.05 - tipH) * k);
                if (bullet.current) {
                    // streak: stretched along the line of fire
                    bullet.current.scale.set(1.4 * side, 1, 1);
                }
            }
            if (t >= hit && t < hit + 0.16) {
                vis(burst, true);
                put(burst.current, v, 0, 1.0);
                if (burst.current) burst.current.scale.setScalar(0.5 + ramp(t, hit, hit + 0.06) * 1.0);
            }
            if (t >= fire) {
                vis(word, true);
                put(word.current, a, side * 0.6, 3.0);
                pop(word.current, (t - fire) / 0.6, 0.55, 1, 1.25);
            }
            orbit(hit + 0.03, hit + 0.45);
        }

        if (effect.style === 'DOG') {
            const { whistle: w, bite } = SCENE.DOG;
            if (t < w) {
                vis(whistle, true);
                put(whistle.current, a, side * 0.55, 1.12);
                if (whistle.current) whistle.current.scale.set(side * 1.9, 1.9, 1);
                vis(waves, true);
                put(waves.current, a, side * 0.95, 1.15);
                if (waves.current) {
                    waves.current.scale.set(side * 1.9, 1.9, 1);
                    waves.current.children.forEach((arc, i) => {
                        const k = (t * 3.2 + i / 3) % 1;
                        arc.position.x = k * 1.1;
                        arc.scale.setScalar(0.5 + k * 0.9);
                        arc.visible = k < 0.95;
                    });
                }
                vis(word, true);
                put(word.current, a, side * 0.2, 3.0);
                pop(word.current, t / w, 0.8, 1, 1.0);
            }
            if (t >= bite - 0.02 && t < bite + 0.14) {
                vis(burst, true);
                put(burst.current, v, 0, 0.9);
                if (burst.current) burst.current.scale.setScalar(0.5 + ramp(t, bite, bite + 0.06));
            }
            if (t >= bite) {
                vis(word2, true);
                put(word2.current, v, 0, 3.0);
                pop(word2.current, (t - bite) / 0.5, 0.6, 1, 1.15);
            }
            orbit(bite + 0.02, bite + 0.45);
            if (t > 0.84) {
                vis(lock, true);
                put(lock.current, new THREE.Vector3(effect.homePos[0], 0, effect.homePos[2]), 0, 1.5);
                if (lock.current) lock.current.scale.setScalar(Math.max(0.001, ramp(t, 0.84, 0.92) * 1.15));
            }
        }

        if (effect.style === 'PENALTY') {
            vis(warn, true);
            put(warn.current, v, 0, 2.6 + Math.sin(c.elapsedTime * 10) * 0.05);
            vis(word, true);
            put(word.current, v, 0, 3.6);
            pop(word.current, t / 0.8, 0.8, 1, 1.0);
            orbit(0.3, 0.8);
        }
    });

    return (
        <>
            {([ringA, ringV] as const).map((r, i) => (
                <mesh key={i} ref={r} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
                    <ringGeometry args={[0.62, 0.8, 36]} />
                    <meshBasicMaterial color={i === 0 ? '#ffb800' : '#ff4d4d'} toneMapped={false} />
                </mesh>
            ))}

            <Word
                g={gref(word)}
                text={effect?.style === 'SLAP' ? 'SMACK!' : effect?.style === 'GUN' ? 'BANG!' : effect?.style === 'DOG' ? 'FWEEET!' : 'OOPS!'}
                color={effect?.style === 'SLAP' ? '#ffd23a' : effect?.style === 'GUN' ? '#ff5a3d' : effect?.style === 'DOG' ? '#7fd1ff' : '#ff8b8f'}
                size={1.3}
            />
            <Word g={gref(word2)} text="WOOF! WOOF!" color="#ffb347" size={0.85} />

            <Burst g={gref(burst)} color={effect?.style === 'SLAP' ? '#ffd23a' : '#ff5a3d'} size={0.75} />

            {/* gun */}
            <Burst g={gref(flash)} color="#ffe14a" size={0.55} />
            <Flat gref={gref(bullet)}>
                <mesh position={[-0.7, 0, 0]}>
                    <planeGeometry args={[1.5, 0.07]} />
                    {basic('#fff3a0', { opacity: 0.8 })}
                </mesh>
                <mesh>
                    <circleGeometry args={[0.1, 14]} />
                    {basic('#ffd23a')}
                </mesh>
            </Flat>
            <Flat gref={gref(smoke)}>
                {[[0, 0, 0.3], [0.22, 0.1, 0.22], [-0.18, 0.14, 0.2]].map(([x, y, r], i) => (
                    <mesh key={i} position={[x as number, y as number, 0]}>
                        <circleGeometry args={[r as number, 16]} />
                        {basic('#e9e4dc', { opacity: 0.85 })}
                    </mesh>
                ))}
            </Flat>

            {/* slap */}
            <Flat gref={gref(swoosh)}>
                <mesh rotation={[0, 0, -0.6]}>
                    <ringGeometry args={[0.8, 1.05, 28, 1, 0, Math.PI * 0.9]} />
                    {basic('#ffffff')}
                </mesh>
                <mesh rotation={[0, 0, -0.55]}>
                    <ringGeometry args={[0.55, 0.65, 28, 1, 0.1, Math.PI * 0.7]} />
                    {basic('#ffd23a')}
                </mesh>
            </Flat>
            <Flat gref={gref(hand)}>
                <mesh>
                    <circleGeometry args={[0.2, 16]} />
                    {basic('#e0343a', { opacity: 0.85 })}
                </mesh>
                {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
                    <mesh key={i} position={[x, 0.27 + (i === 1 || i === 2 ? 0.05 : 0), 0]}>
                        <planeGeometry args={[0.07, 0.24]} />
                        {basic('#e0343a', { opacity: 0.85 })}
                    </mesh>
                ))}
                <mesh position={[0.24, 0.05, 0]} rotation={[0, 0, -0.9]}>
                    <planeGeometry args={[0.07, 0.2]} />
                    {basic('#e0343a', { opacity: 0.85 })}
                </mesh>
            </Flat>

            {/* stars over the victim's head */}
            <Flat gref={gref(stars)}>
                {[0, 1, 2, 3, 4].map(i => (
                    <mesh key={i} geometry={starGeo}>
                        {basic('#ffd23a')}
                    </mesh>
                ))}
            </Flat>

            {/* whistle + sound waves */}
            <Flat gref={gref(whistle)}>
                <mesh>
                    <planeGeometry args={[0.34, 0.16]} />
                    {basic('#c9d3dc')}
                </mesh>
                <mesh position={[0.2, 0, 0]}>
                    <circleGeometry args={[0.12, 16]} />
                    {basic('#8e9aa6')}
                </mesh>
                <mesh position={[0.2, 0, 0.01]}>
                    <circleGeometry args={[0.04, 10]} />
                    {basic('#1a0f08')}
                </mesh>
            </Flat>
            <Flat gref={gref(waves)}>
                {[0, 1, 2].map(i => (
                    <mesh key={i} rotation={[0, 0, -Math.PI / 3]}>
                        <ringGeometry args={[0.28, 0.35, 20, 1, 0, (Math.PI * 2) / 3]} />
                        {basic('#7fd1ff')}
                    </mesh>
                ))}
            </Flat>

            {/* padlock on the victim's home */}
            <Flat gref={gref(lock)}>
                <mesh position={[0, 0.18, 0]}>
                    <ringGeometry args={[0.2, 0.3, 20, 1, 0, Math.PI]} />
                    {basic('#c9d3dc')}
                </mesh>
                <mesh position={[0, -0.05, 0.01]}>
                    <planeGeometry args={[0.7, 0.55]} />
                    {basic('#ffb800')}
                </mesh>
                <mesh position={[0, -0.05, 0.02]}>
                    <circleGeometry args={[0.09, 12]} />
                    {basic('#1a0f08')}
                </mesh>
                <Text font={GAME_FONT} position={[0, -0.55, 0.02]} fontSize={0.3} color="#ffffff" outlineColor="#1a0f08" outlineWidth={0.05} anchorX="center">
                    LOCKED!
                </Text>
            </Flat>

            {/* penalty warning sign */}
            <Flat gref={gref(warn)}>
                <mesh geometry={warnGeo} scale={1.1}>{basic('#1a0f08')}</mesh>
                <mesh geometry={warnGeo} position={[0, -0.02, 0.01]} scale={0.95}>{basic('#ffb800')}</mesh>
                <Text font={GAME_FONT} position={[0, -0.08, 0.02]} fontSize={0.5} color="#1a0f08" anchorX="center" anchorY="middle">
                    !
                </Text>
            </Flat>
        </>
    );
}
