import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { type BoardLayout } from '../boardLayout';
import { type CameraActions } from './types';

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

    const target = useRef(new THREE.Vector3());
    const moving = useRef(false);

    const setSeatView = (instant: boolean) => {
        const base = layout.bases[seat];
        const direction = new THREE.Vector3(
            base[0],
            0,
            base[2]
        ).normalize();

        const { width, height } = size;
        const aspect = width / Math.max(1, height);
        // Narrow canvases (phones) need more distance so the whole arena fits.
        const fit = Math.max(1, 1.3 / aspect);
        const distance = layout.extent * 1.8 * fit;

        target.current.set(
            direction.x * distance,
            layout.extent * 1.3 * fit,
            direction.z * distance
        );

        if (instant) {
            camera.position.copy(target.current);
            camera.lookAt(0, 0, 0);
            moving.current = false;
        } else {
            moving.current = true;
        }
    };

    useEffect(() => {
        setSeatView(true);
        // Set initial position or geometry change.
    }, [camera, layout]);

    useEffect(() => {
        setSeatView(false);
        // Smooth rotation when the chosen seat changes.
    }, [seat]);

    useEffect(() => {
        const zoom = (factor: number) => {
            const length = camera.position.length();

            const next = THREE.MathUtils.clamp(
                length * factor,
                3,
                layout.extent * 5
            );

            camera.position.multiplyScalar(next / length);
            target.current.copy(camera.position);
            moving.current = false;
        };

        actions.current = {
            zoomIn: () => zoom(0.82),
            zoomOut: () => zoom(1.22),
            resetView: () => setSeatView(false),
        };

        return () => {
            actions.current = null;
        };
    }, [actions, camera, layout, seat]);

    useFrame((_, delta) => {
        if (!moving.current) return;

        camera.position.lerp(
            target.current,
            1 - Math.exp(-delta * 3.7)
        );

        camera.lookAt(0, 0, 0);

        if (
            camera.position.distanceTo(
                target.current
            ) < 0.03
        ) {
            camera.position.copy(target.current);
            moving.current = false;
        }
    });

    return (
        <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={layout.extent * 5}
            minPolarAngle={0.16}
            maxPolarAngle={Math.PI / 2.08}
            onStart={() => {
                moving.current = false;
            }}
        />
    );
}
