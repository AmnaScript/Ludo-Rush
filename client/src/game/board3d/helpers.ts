import * as THREE from 'three';
import { type Vec3 } from '../boardLayout';

export function vec(position: THREE.Vector3): Vec3 {
    return [
        position.x,
        position.y,
        position.z,
    ];
}

export function place(
    object: THREE.Object3D,
    position: Vec3
): void {
    object.position.set(...position);
}

export function moveBetween(
    object: THREE.Object3D,
    from: Vec3,
    to: Vec3,
    t: number
): void {
    object.position.set(
        THREE.MathUtils.lerp(from[0], to[0], t),
        THREE.MathUtils.lerp(from[1], to[1], t),
        THREE.MathUtils.lerp(from[2], to[2], t)
    );
}

export function faceToward(
    object: THREE.Object3D,
    from: Vec3,
    to: Vec3
): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];

    if (Math.hypot(dx, dz) > 0.005) {
        object.rotation.y = Math.atan2(dx, dz);
    }
}

export function smooth(t: number): number {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}
