import * as THREE from 'three';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { type BoardLayout } from '../boardLayout';
import { type CameraActions } from './types';

/**
 * Fixed, automatic camera (no user zoom / orbit). It sits behind the viewing
 * seat's home and swoops in on capture scenes via `focus`.
 */
export function HomeCamera({
    layout,
    seat,
    actions,
    focus,
}: {
    layout: BoardLayout;
    seat: number;
    actions: CameraActions;
    focus: MutableRefObject<THREE.Vector3 | null>;
}) {
    const { camera, size } = useThree();
    const look = useRef(new THREE.Vector3());
    const wantPos = useRef(new THREE.Vector3());
    const wantLook = useRef(new THREE.Vector3());
    const ready = useRef(false);

    const compute = () => {
        const base = layout.bases[seat];
        const dir = new THREE.Vector3(base[0], 0, base[2]).normalize();
        const f = focus.current;

        if (f) {
            wantLook.current.copy(f);
            wantPos.current.set(
                f.x + dir.x * 8.5,
                8.6,
                f.z + dir.z * 8.5
            );
            return;
        }

        const aspect = size.width / Math.max(1, size.height);
        // Narrow canvases (phones) need more distance so the whole board fits.
        const fit = Math.max(1, 1.25 / aspect);
        const distance = layout.extent * 1.7 * fit;
        // look a little towards the viewer so the board sits above the dice dock
        wantLook.current.set(dir.x * layout.extent * 0.16, 0, dir.z * layout.extent * 0.16);
        wantPos.current.set(
            dir.x * distance,
            layout.extent * 1.25 * fit,
            dir.z * distance
        );
    };

    useEffect(() => {
        ready.current = false;
    }, [layout, size.width, size.height]);

    useEffect(() => {
        actions.current = {
            resetView: () => {
                ready.current = false;
            },
        };
        return () => {
            actions.current = null;
        };
    }, [actions]);

    useFrame((_, delta) => {
        compute();

        if (!ready.current) {
            camera.position.copy(wantPos.current);
            look.current.copy(wantLook.current);
            camera.lookAt(look.current);
            ready.current = true;
            return;
        }

        const k = 1 - Math.exp(-delta * (focus.current ? 4.2 : 3));
        camera.position.lerp(wantPos.current, k);
        look.current.lerp(wantLook.current, k);
        camera.lookAt(look.current);
    });

    return null;
}
