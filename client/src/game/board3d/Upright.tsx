import * as THREE from 'three';
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { counterScale, screen, screenDown } from './screen';

const Y = new THREE.Vector3(0, 1, 0);
const TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const tmp = new THREE.Quaternion();

/** Puts a flat group on the board so it reads upright on the screen (no depth). */
export function Flat({ children, y = 6, gref }: { children?: ReactNode; y?: number; gref?: (g: THREE.Group | null) => void }) {
    const ref = useRef<THREE.Group | null>(null);
    const inner = useRef<THREE.Group>(null);
    useFrame(() => {
        const g = ref.current;
        if (!g) return;
        inner.current?.scale.set(1 / screen.stretch, 1, 1);
        g.quaternion.setFromAxisAngle(Y, screen.yaw).multiply(TILT);
        g.position.y = y;
    });
    return (
        <group
            ref={node => {
                ref.current = node;
                gref?.(node);
            }}
        >
            <group ref={inner}>{children}</group>
        </group>
    );
}

/**
 * Stands a character-like model up on the screen. With the camera looking
 * straight down, the model's front faces the viewer and its up points to the
 * top of the screen. The parent's `userData.yaw` turns it to profile / back
 * (0 = facing the viewer, +PI/2 = facing screen-right).
 */
export function Upright({ children }: { children: ReactNode }) {
    const tilt = useRef<THREE.Group>(null);
    const face = useRef<THREE.Group>(null);

    useFrame(() => {
        const t = tilt.current;
        const f = face.current;
        const parent = t?.parent;
        if (!t || !f || !parent) return;

        t.scale.set(1 / screen.stretch, 1, 0.07);
        t.quaternion.setFromAxisAngle(Y, screen.yaw);
        tmp.copy(TILT);
        t.quaternion.multiply(tmp);

        // pieces lower on the screen draw in front of the ones above them
        t.position.y = 2 + screenDown(parent.position) * 0.18;

        const target = (parent.userData.yaw as number | undefined) ?? 0;
        const d = Math.atan2(Math.sin(target - f.rotation.y), Math.cos(target - f.rotation.y));
        f.rotation.y += d * 0.4;
    });

    return (
        <group ref={tilt}>
            <group ref={face}>{children}</group>
        </group>
    );
}

/** Keeps flat round things (rings, shadows) round while the board is stretched. */
export function WorldCounter({ children }: { children: ReactNode }) {
    const g = useRef<THREE.Group>(null);
    useFrame(() => {
        const [x, y, z] = counterScale();
        g.current?.scale.set(x, y, z);
    });
    return <group ref={g}>{children}</group>;
}

/** Stretches the board (and everything standing on it) to fill a wide window. */
export function Stretch({ children }: { children: ReactNode }) {
    const g = useRef<THREE.Group>(null);
    useFrame(() => {
        const k = screen.stretch;
        g.current?.scale.set(Math.abs(screen.right.x) > 0.5 ? k : 1, 1, Math.abs(screen.right.z) > 0.5 ? k : 1);
    });
    return <group ref={g}>{children}</group>;
}
