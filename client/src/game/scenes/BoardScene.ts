
import Phaser from 'phaser';
import {
    createBoardGeometry,
    seatColor,
    type BoardGeometry,
} from '@ludo-rush/shared';

const BACKGROUND = 0x111527;
const PALE = 0xeaf1ff;
const TILE = 0x29334d;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;

export class BoardScene extends Phaser.Scene {
    private playerCount = 4;
    private geometry: BoardGeometry | null = null;
    private board: Phaser.GameObjects.Container | null = null;
    private ready = false;
    private fitZoom = 1;
    private dragging = false;
    private lastPointer = new Phaser.Math.Vector2();
    private lastPinchDistance = 0;

    constructor() {
        super({ key: 'BoardScene' });
    }

    create(): void {
        this.ready = true;
        this.cameras.main.setBackgroundColor(BACKGROUND);
        this.input.addPointer(2);

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.dragging = true;
            this.lastPointer.set(pointer.x, pointer.y);
            this.lastPinchDistance = 0;
        });

        this.input.on('pointerup', () => {
            this.dragging = false;
            this.lastPinchDistance = 0;
        });

        this.input.on('pointerupoutside', () => {
            this.dragging = false;
            this.lastPinchDistance = 0;
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown || this.twoFingersDown()) return;

            if (!this.dragging) {
                this.dragging = true;
                this.lastPointer.set(pointer.x, pointer.y);
                return;
            }

            const camera = this.cameras.main;

            camera.scrollX -=
                (pointer.x - this.lastPointer.x) / camera.zoom;

            camera.scrollY -=
                (pointer.y - this.lastPointer.y) / camera.zoom;

            this.lastPointer.set(pointer.x, pointer.y);
        });

        this.input.on(
            'wheel',
            (
                _pointer: Phaser.Input.Pointer,
                _objects: unknown,
                _dx: number,
                dy: number
            ) => {
                this.zoomBy(dy > 0 ? 0.9 : 1.1);
            }
        );

        this.scale.on(
            Phaser.Scale.Events.RESIZE,
            this.handleResize,
            this
        );

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.scale.off(
                    Phaser.Scale.Events.RESIZE,
                    this.handleResize,
                    this
                );
            }
        );

        this.redraw();
    }

    update(): void {
        const first = this.input.pointer1;
        const second = this.input.pointer2;

        if (!first?.isDown || !second?.isDown) {
            this.lastPinchDistance = 0;
            return;
        }

        const distance = Phaser.Math.Distance.Between(
            first.x,
            first.y,
            second.x,
            second.y
        );

        if (this.lastPinchDistance > 0 && distance > 0) {
            this.zoomBy(distance / this.lastPinchDistance);
        }

        this.lastPinchDistance = distance;
    }

    private twoFingersDown(): boolean {
        return Boolean(
            this.input.pointer1?.isDown &&
            this.input.pointer2?.isDown
        );
    }

    setPlayerCount(count: number): void {
        this.playerCount = Phaser.Math.Clamp(
            Math.round(count),
            2,
            20
        );

        if (this.ready) this.redraw();
    }

    zoomBy(factor: number): void {
        if (!this.ready) return;

        const camera = this.cameras.main;

        camera.setZoom(
            Phaser.Math.Clamp(
                camera.zoom * factor,
                MIN_ZOOM,
                MAX_ZOOM
            )
        );
    }

    resetView(): void {
        if (!this.ready || !this.geometry) return;

        const { width, height } = this.scale;
        const { bounds } = this.geometry;

        const worldWidth = bounds.maxX - bounds.minX;
        const worldHeight = bounds.maxY - bounds.minY;

        this.fitZoom = Phaser.Math.Clamp(
            Math.min(
                (width - 36) / worldWidth,
                (height - 36) / worldHeight
            ),
            MIN_ZOOM,
            MAX_ZOOM
        );

        const camera = this.cameras.main;

        camera.setZoom(this.fitZoom);
        camera.centerOn(0, 0);
    }

    private handleResize(): void {
        this.resetView();
    }

    private colorForSeat(seat: number): number {
        const hsl = seatColor(
            seat,
            this.playerCount
        );

        const hue =
            Number(hsl.match(/hsl\(([^ ]+)/)?.[1] ?? 0) /
            360;

        return Phaser.Display.Color.HSLToColor(
            hue,
            0.75,
            0.48
        ).color;
    }

    private label(
        x: number,
        y: number,
        value: string,
        size = 15,
        color = '#ffffff'
    ): Phaser.GameObjects.Text {
        const text = this.add
            .text(x, y, value, {
                fontFamily: 'Arial, sans-serif',
                fontSize: `${size}px`,
                fontStyle: 'bold',
                color,
                align: 'center',
            })
            .setOrigin(0.5);

        this.board!.add(text);

        return text;
    }

    private redraw(): void {
        if (!this.ready) return;

        this.board?.destroy(true);

        this.board = this.add.container(0, 0);

        this.geometry = createBoardGeometry(
            this.playerCount
        );

        const geometry = this.geometry;

        const graphics = this.add.graphics();

        this.board.add(graphics);

        const safeTiles = new Set(
            geometry.safeTiles
        );

        // Decorative board rings and central finish area.
        graphics.lineStyle(
            2,
            0x50617c,
            0.23
        );

        graphics.strokeCircle(
            0,
            0,
            geometry.radius + 27
        );

        graphics.strokeCircle(
            0,
            0,
            geometry.radius - 28
        );

        graphics.fillStyle(
            0x1d2842,
            0.95
        );

        graphics.fillCircle(
            0,
            0,
            Math.min(115, geometry.radius * 0.32)
        );

        graphics.lineStyle(
            3,
            0x7182a1,
            0.55
        );

        graphics.strokeCircle(
            0,
            0,
            Math.min(115, geometry.radius * 0.32)
        );

        // Shared circular ring.
        geometry.ring.forEach(({ x, y, cell }) => {
            if (cell.kind !== 'ring') return;

            const index = cell.index;

            const seat = Math.floor(
                index / geometry.S
            );

            const start =
                index % geometry.S === 0;

            const safe = safeTiles.has(index);

            const color = this.colorForSeat(seat);

            graphics.fillStyle(
                start ? color : TILE,
                start ? 1 : 0.98
            );

            graphics.fillRoundedRect(
                x - 20,
                y - 20,
                40,
                40,
                9
            );

            graphics.lineStyle(
                start ? 3 : 2,
                color,
                start ? 1 : 0.55
            );

            graphics.strokeRoundedRect(
                x - 20,
                y - 20,
                40,
                40,
                9
            );

            if (safe) {
                this.label(
                    x,
                    y,
                    start ? '⌂' : '★',
                    21,
                    start ? '#ffffff' : '#f7dc81'
                );
            } else {
                this.label(
                    x,
                    y,
                    String(index + 1),
                    10,
                    '#9babc6'
                );
            }
        });

        // Private home lanes.
        geometry.lanes.forEach((lane, seat) => {
            const color = this.colorForSeat(seat);

            lane.forEach(({ x, y }, index) => {
                graphics.fillStyle(
                    color,
                    0.74
                );

                graphics.fillRoundedRect(
                    x - 17,
                    y - 17,
                    34,
                    34,
                    8
                );

                graphics.lineStyle(
                    2,
                    PALE,
                    0.35
                );

                graphics.strokeRoundedRect(
                    x - 17,
                    y - 17,
                    34,
                    34,
                    8
                );

                this.label(
                    x,
                    y,
                    String(index + 1),
                    12
                );
            });
        });

        // Player bases, with four placeholder positions.
        geometry.bases.forEach(base => {
            const color = this.colorForSeat(
                base.seat
            );

            graphics.fillStyle(
                0x1f2941,
                1
            );

            graphics.fillRoundedRect(
                base.x - 52,
                base.y - 51,
                104,
                102,
                20
            );

            graphics.lineStyle(
                3,
                color,
                1
            );

            graphics.strokeRoundedRect(
                base.x - 52,
                base.y - 51,
                104,
                102,
                20
            );

            for (const piece of base.pieces) {
                graphics.fillStyle(
                    color,
                    0.9
                );

                graphics.fillCircle(
                    piece.x,
                    piece.y,
                    11
                );

                graphics.lineStyle(
                    2,
                    0xffffff,
                    0.7
                );

                graphics.strokeCircle(
                    piece.x,
                    piece.y,
                    11
                );
            }

            const nameAngle = Math.atan2(
                base.y,
                base.x
            );

            this.label(
                base.x +
                Math.cos(nameAngle) * 75,
                base.y +
                Math.sin(nameAngle) * 75,
                `P${base.seat + 1}`,
                19
            );
        });

        // Center HUD placeholder.
        this.label(
            0,
            -21,
            'LUDO',
            29,
            '#ffffff'
        );

        this.label(
            0,
            14,
            'RUSH',
            29,
            '#f4c661'
        );

        this.label(
            0,
            48,
            `${geometry.N} PLAYERS`,
            13,
            '#b9c6e2'
        );

        this.resetView();
    }
}
