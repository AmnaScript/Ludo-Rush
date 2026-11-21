import * as THREE from 'three';
import { type Vec3 } from '../boardLayout';

/**
 * The board is viewed straight from above with a fixed orientation. `up` and
 * `right` are the world directions that point to the top / right of the screen.
 */
export const screen = {
    up: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    /** Rotation about Y that maps (0,0,-1) onto `up`. */
    yaw: 0,
};

export function setScreenUp(ux: number, uz: number) {
    screen.up.set(ux, 0, uz);
    // right = up x Y
    screen.right.set(-uz, 0, ux);
    screen.yaw = Math.atan2(-ux, -uz);
}

/** How far down the screen a world point is (larger = nearer the bottom). */
export function screenDown(p: { x: number; z: number }) {
    return -(p.x * screen.up.x + p.z * screen.up.z);
}

/** Point `h` above (towards the top of the screen) and `dx` to the right of `p`, at height y. */
export function onScreen(p: Vec3, dx: number, h: number, y = 6): Vec3 {
    return [
        p[0] + screen.right.x * dx + screen.up.x * h,
        y,
        p[2] + screen.right.z * dx + screen.up.z * h,
    ];
}
