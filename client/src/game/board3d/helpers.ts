import * as THREE from 'three';
import { type Vec3 } from '../boardLayout';
import { screen } from './screen';

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

/**
 * Turn a character / dog towards a direction of travel. The model stands up
 * facing the viewer, so this stores a yaw that Upright applies:
 * 0 = towards the viewer, PI/2 = right, PI = away, -PI/2 = left.
 */
export function faceToward(
    object: THREE.Object3D,
    from: Vec3,
    to: Vec3
): void {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];

    if (Math.hypot(dx, dz) > 0.005) {
        const right = dx * screen.right.x + dz * screen.right.z;
        const down = -(dx * screen.up.x + dz * screen.up.z);
        object.userData.yaw = Math.atan2(right, down);
    }
}

/** Face left or right on screen, towards a target. Profile reads best for slap / gun. */
export function faceSide(object: THREE.Object3D, from: Vec3, to: Vec3): void {
    const right = (to[0] - from[0]) * screen.right.x + (to[2] - from[2]) * screen.right.z;
    object.userData.yaw = right >= 0 ? Math.PI / 2 : -Math.PI / 2;
}

export function smooth(t: number): number {
    const x = THREE.MathUtils.clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
}

