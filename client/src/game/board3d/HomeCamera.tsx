import * as THREE from 'three';
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { type BoardLayout } from '../boardLayout';
import { type CameraActions } from './types';
import { screen, setScreenUp } from './screen';

const CANDIDATES: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const TOP_BAR = 64; // px reserved for the title pills
const DOCK = 118; // px reserved for the dice dock

/**
 * Fixed top-down camera. The whole board is flat on screen, never tilts and
 * never moves: not for turns and not for capture scenes.
 * The viewing seat's home sits in the bottom-left corner.
 */
export function HomeCamera({
    layout,
    seat,
    actions,
}: {
    layout: BoardLayout;
    seat: number;
    actions: CameraActions;
}) {
    const { camera, size } = useThree();

    // choose the quarter turn that puts our home bottom-left
    useEffect(() => {
        const base = layout.bases[seat] ?? [0, 0, 0];
        let best: [number, number] = [0, -1];
        let score = -Infinity;
        for (const [ux, uz] of CANDIDATES) {
            const rx = -uz;
            const rz = ux;
            const x = base[0] * rx + base[2] * rz; // screen right
            const y = base[0] * ux + base[2] * uz; // screen up
            const s = -x - y; // bottom-left = most negative on both
            if (s > score) {
                score = s;
                best = [ux, uz];
            }
        }
        setScreenUp(best[0], best[1]);
    }, [layout, seat]);

    useEffect(() => {
        actions.current = { resetView: () => {} };
        return () => {
            actions.current = null;
        };
    }, [actions]);

    useFrame(() => {
        const cam = camera as THREE.OrthographicCamera;
        const wide = size.width >= 1024;
        const availH = Math.max(120, size.height - TOP_BAR - DOCK);
        const availW = size.width - (wide ? 24 : 12);
        const span = layout.mode === 'classic' ? 16.3 : layout.extent * 2 + 0.4;
        const zoom = Math.min(availW, availH) / span;

        // Centre the board in the free area between the title pills and the dock.
        // Moving the look-at point up the screen pushes the board down.
        const shiftPx = TOP_BAR + availH / 2 - size.height / 2;
        const k = shiftPx / zoom;

        cam.zoom = zoom;
        cam.updateProjectionMatrix();
        cam.up.copy(screen.up);
        cam.position.set(screen.up.x * k, 60, screen.up.z * k);
        cam.lookAt(screen.up.x * k, 0, screen.up.z * k);
    });

    return null;
}
