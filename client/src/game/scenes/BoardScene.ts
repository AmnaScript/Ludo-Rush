
import Phaser from 'phaser';
import {
    createBoardGeometry,
    seatColor,
    tileOf,
    type BoardCell,
    type BoardGeometry,
    type GameState,
    type MoveResult,
    type Piece,
} from '@ludo-rush/shared';

const BACKGROUND = 0x111527;
const TILE = 0x29334d;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 2.5;

type PickPiece = (id: string) => void;

export class BoardScene extends Phaser.Scene {
    private count = 4;
    private geometry: BoardGeometry | null = null;

    private board: Phaser.GameObjects.Container | null = null;
    private piecesLayer: Phaser.GameObjects.Container | null = null;

    private sprites = new Map<string, Phaser.GameObjects.Container>();

    private snapshot: GameState | null = null;
    private validIds: string[] = [];
    private onPick: PickPiece = () => { };

    private ready = false;
    private animating = false;
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

        this.input.on(
            'pointerdown',
            (pointer: Phaser.Input.Pointer) => {
                this.dragging = true;
                this.lastPointer.set(pointer.x, pointer.y);
            }
        );

        this.input.on('pointerup', () => {
            this.dragging = false;
        });

        this.input.on('pointerupoutside', () => {
            this.dragging = false;
        });

        this.input.on(
            'pointermove',
            (pointer: Phaser.Input.Pointer) => {
                if (
                    !pointer.isDown ||
                    this.twoFingersDown()
                ) {
                    return;
                }

                if (!this.dragging) {
                    this.lastPointer.set(
                        pointer.x,
                        pointer.y
                    );
                    this.dragging = true;
                    return;
                }

                const camera = this.cameras.main;

                camera.scrollX -=
                    (pointer.x - this.lastPointer.x) /
                    camera.zoom;

                camera.scrollY -=
                    (pointer.y - this.lastPointer.y) /
                    camera.zoom;

                this.lastPointer.set(
                    pointer.x,
                    pointer.y
                );
            }
        );

        this.input.on(
            'wheel',
            (
                _pointer: Phaser.Input.Pointer,
                _objects: unknown,
                _dx: number,
                dy: number
            ) => {
                this.zoomBy(
                    dy > 0 ? 0.9 : 1.1
                );
            }
        );

        this.scale.on(
            Phaser.Scale.Events.RESIZE,
            this.resetView,
            this
        );

        this.events.once(
            Phaser.Scenes.Events.SHUTDOWN,
            () => {
                this.ready = false;

                this.scale.off(
                    Phaser.Scale.Events.RESIZE,
                    this.resetView,
                    this
                );
            }
        );

        this.drawBoard();
    }

    update(): void {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;

        if (!p1?.isDown || !p2?.isDown) {
            this.lastPinchDistance = 0;
            return;
        }

        const distance =
            Phaser.Math.Distance.Between(
                p1.x,
                p1.y,
                p2.x,
                p2.y
            );

        if (
            this.lastPinchDistance > 0 &&
            distance > 0
        ) {
            this.zoomBy(
                distance / this.lastPinchDistance
            );
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
        if (this.snapshot) return;

        this.count = Phaser.Math.Clamp(
            Math.round(count),
            2,
            20
        );

        if (this.ready) {
            this.drawBoard();
        }
    }

    setGame(
        game: GameState | null,
        validIds: string[],
        onPick: PickPiece
    ): void {
        this.snapshot = game;
        this.validIds = validIds;
        this.onPick = onPick;

        if (!this.ready || this.animating) {
            return;
        }

        if (game && game.N !== this.count) {
            this.count = game.N;
            this.drawBoard();
            return;
        }

        this.drawPieces();
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
        if (!this.ready || !this.geometry) {
            return;
        }

        const { width, height } = this.scale;
        const { bounds } = this.geometry;

        const worldWidth =
            bounds.maxX - bounds.minX;

        const worldHeight =
            bounds.maxY - bounds.minY;

        const zoom = Phaser.Math.Clamp(
            Math.min(
                (width - 36) / worldWidth,
                (height - 36) / worldHeight
            ),
            MIN_ZOOM,
            MAX_ZOOM
        );

        const camera = this.cameras.main;

        camera.setZoom(zoom);
        camera.centerOn(0, 0);
    }

    private color(seat: number): number {
        const hsl = seatColor(
            seat,
            this.count
        );

        const hue =
            Number(
                hsl.match(/hsl\(([^ ]+)/)?.[1] ??
                0
            ) / 360;

        return Phaser.Display.Color.HSLToColor(
            hue,
            0.75,
            0.48
        ).color;
    }

    private addLabel(
        x: number,
        y: number,
        value: string,
        size = 15,
        color = '#ffffff'
    ): void {
        const text = this.add
            .text(x, y, value, {
                fontFamily: 'Arial, sans-serif',
                fontSize: `${size}px`,
                fontStyle: 'bold',
                color,
                align: 'center',
            })
            .setOrigin(0.5);

        this.board?.add(text);
    }

    private drawBoard(): void {
        if (!this.ready) return;

        this.board?.destroy(true);
        this.sprites.clear();

        this.board = this.add.container(0, 0);

        const settings = this.snapshot;

        const geometry = createBoardGeometry(
            settings?.N ?? this.count,
            settings?.S,
            settings?.H
        );

        this.geometry = geometry;

        const graphics = this.add.graphics();
        this.board.add(graphics);

        const safeTiles = new Set<number>();

        // Same defaults as Phase 1.
        for (
            let seat = 0;
            seat < geometry.N;
            seat++
        ) {
            safeTiles.add(seat * geometry.S);

            safeTiles.add(
                seat * geometry.S +
                Math.floor(geometry.S / 2)
            );
        }

        graphics.lineStyle(
            2,
            0x50617c,
            0.35
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
            1
        );

        graphics.fillCircle(
            0,
            0,
            Math.min(
                115,
                geometry.radius * 0.32
            )
        );

        graphics.lineStyle(
            3,
            0x7182a1,
            0.6
        );

        graphics.strokeCircle(
            0,
            0,
            Math.min(
                115,
                geometry.radius * 0.32
            )
        );

        // Ring tiles.
        geometry.ring.forEach(
            ({ x, y, cell }) => {
                if (cell.kind !== 'ring') {
                    return;
                }

                const index = cell.index;

                const seat = Math.floor(
                    index / geometry.S
                );

                const start =
                    index % geometry.S === 0;

                const safe = safeTiles.has(index);

                const color = this.color(seat);

                graphics.fillStyle(
                    start ? color : TILE,
                    1
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
                    this.addLabel(
                        x,
                        y,
                        start ? '⌂' : '★',
                        21,
                        start
                            ? '#ffffff'
                            : '#f7dc81'
                    );
                } else {
                    this.addLabel(
                        x,
                        y,
                        String(index + 1),
                        10,
                        '#9babc6'
                    );
                }
            }
        );

        // Home lanes.
        geometry.lanes.forEach(
            (lane, seat) => {
                const color = this.color(seat);

                lane.forEach(
                    ({ x, y }, index) => {
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
                            0xffffff,
                            0.35
                        );

                        graphics.strokeRoundedRect(
                            x - 17,
                            y - 17,
                            34,
                            34,
                            8
                        );

                        this.addLabel(
                            x,
                            y,
                            String(index + 1),
                            12
                        );
                    }
                );
            }
        );

        // Player bases.
        geometry.bases.forEach(base => {
            const color = this.color(
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

            const angle = Math.atan2(
                base.y,
                base.x
            );

            this.addLabel(
                base.x +
                Math.cos(angle) * 75,
                base.y +
                Math.sin(angle) * 75,
                `P${base.seat + 1}`,
                19
            );

            // Show empty base slots.
            base.pieces.forEach(position => {
                graphics.lineStyle(
                    2,
                    color,
                    0.35
                );

                graphics.strokeCircle(
                    position.x,
                    position.y,
                    12
                );
            });
        });

        this.addLabel(
            0,
            -21,
            'LUDO',
            29
        );

        this.addLabel(
            0,
            14,
            'RUSH',
            29,
            '#f4c661'
        );

        this.addLabel(
            0,
            48,
            `${geometry.N} PLAYERS`,
            13,
            '#b9c6e2'
        );

        this.piecesLayer = this.add.container(
            0,
            0
        );

        this.drawPieces();
        this.resetView();
    }

    private pointForCell(
        cell: BoardCell
    ): Phaser.Math.Vector2 {
        const g = this.geometry!;

        if (cell.kind === 'ring') {
            const point = g.ring[cell.index];

            return new Phaser.Math.Vector2(
                point.x,
                point.y
            );
        }

        if (cell.kind === 'lane') {
            const point =
                g.lanes[cell.seat][cell.index];

            return new Phaser.Math.Vector2(
                point.x,
                point.y
            );
        }

        if (cell.kind === 'base') {
            const point = g.bases[cell.seat];

            return new Phaser.Math.Vector2(
                point.x,
                point.y
            );
        }

        return new Phaser.Math.Vector2(
            0,
            0
        );
    }

    private piecePosition(
        piece: Piece
    ): Phaser.Math.Vector2 {
        const game = this.snapshot;

        if (!game) {
            return new Phaser.Math.Vector2();
        }

        const cell = tileOf(
            piece.ownerSeat,
            piece.progress,
            game.N,
            game.S,
            game.H
        );

        if (cell.kind === 'base') {
            const index = Number(
                piece.id.split('-p')[1] ?? 0
            );

            const slots =
                this.geometry!.bases[
                    piece.ownerSeat
                ].pieces;

            const point =
                slots[index % slots.length];

            return new Phaser.Math.Vector2(
                point.x,
                point.y
            );
        }

        if (cell.kind === 'finish') {
            const angle =
                (Math.PI * 2 *
                    piece.ownerSeat) /
                game.N;

            return new Phaser.Math.Vector2(
                Math.cos(angle) * 45,
                Math.sin(angle) * 45
            );
        }

        return this.pointForCell(cell);
    }

    private drawPieces(): void {
        if (!this.ready) return;

        this.piecesLayer?.removeAll(true);
        this.sprites.clear();

        if (
            !this.snapshot ||
            !this.piecesLayer
        ) {
            return;
        }

        const game = this.snapshot;

        // Spread tokens sharing a cell so every
        // individual piece remains clickable.
        const groups = new Map<
            string,
            Piece[]
        >();

        for (const piece of game.pieces) {
            const cell = tileOf(
                piece.ownerSeat,
                piece.progress,
                game.N,
                game.S,
                game.H
            );

            const key =
                cell.kind === 'ring'
                    ? `ring-${cell.index}`
                    : cell.kind === 'lane'
                        ? `lane-${cell.seat}-${cell.index}`
                        : cell.kind === 'finish'
                            ? `finish-${cell.seat}`
                            : `base-${piece.id}`;

            const entries = groups.get(key) ?? [];
            entries.push(piece);
            groups.set(key, entries);
        }

        for (const entries of groups.values()) {
            entries.forEach((piece, index) => {
                const position = this.piecePosition(
                    piece
                );

                const cell = tileOf(
                    piece.ownerSeat,
                    piece.progress,
                    game.N,
                    game.S,
                    game.H
                );

                if (
                    entries.length > 1 &&
                    cell.kind !== 'base'
                ) {
                    const angle =
                        (Math.PI * 2 * index) /
                        entries.length;

                    position.x +=
                        Math.cos(angle) * 12;

                    position.y +=
                        Math.sin(angle) * 12;
                }

                const legal =
                    this.validIds.includes(
                        piece.id
                    );

                const token = this.add.container(
                    position.x,
                    position.y
                );

                const circle = this.add.circle(
                    0,
                    0,
                    13,
                    this.color(
                        piece.ownerSeat
                    )
                );

                circle.setStrokeStyle(
                    legal ? 4 : 2,
                    legal
                        ? 0xfde68a
                        : 0xffffff
                );

                const number = this.add
                    .text(
                        0,
                        0,
                        String(
                            Number(
                                piece.id.split('-p')[1] ??
                                0
                            ) + 1
                        ),
                        {
                            fontFamily: 'Arial',
                            fontSize: '13px',
                            fontStyle: 'bold',
                            color: '#ffffff',
                        }
                    )
                    .setOrigin(0.5);

                token.add([circle, number]);

                if (legal) {
                    const glow = this.add.circle(
                        0,
                        0,
                        19
                    );

                    glow.setStrokeStyle(
                        3,
                        0xfde68a,
                        1
                    );

                    token.addAt(glow, 0);

                    this.tweens.add({
                        targets: glow,
                        scale: 1.25,
                        alpha: 0.3,
                        duration: 550,
                        yoyo: true,
                        repeat: -1,
                    });
                }

                // The token is a generous tap target.
                const hit = this.add.zone(
                    0,
                    0,
                    38,
                    38
                );

                hit.setInteractive({
                    useHandCursor: legal,
                });

                token.add(hit);

                if (legal) {
                    let downX = 0;
                    let downY = 0;

                    hit.on(
                        'pointerdown',
                        (pointer: Phaser.Input.Pointer) => {
                            downX = pointer.x;
                            downY = pointer.y;
                        }
                    );

                    hit.on(
                        'pointerup',
                        (pointer: Phaser.Input.Pointer) => {
                            const distance =
                                Phaser.Math.Distance.Between(
                                    downX,
                                    downY,
                                    pointer.x,
                                    pointer.y
                                );

                            if (
                                distance < 12 &&
                                !this.animating
                            ) {
                                this.onPick(piece.id);
                            }
                        }
                    );
                }

                this.piecesLayer!.add(token);

                this.sprites.set(
                    piece.id,
                    token
                );
            });
        }
    }

    async animateMove(
        move: MoveResult
    ): Promise<void> {
        if (!this.ready) return;

        const sprite = this.sprites.get(
            move.pieceId
        );

        if (!sprite) return;

        this.animating = true;

        try {
            const duration = move.run
                ? 180
                : 300;

            for (const cell of move.path) {
                const target =
                    this.pointForCell(cell);

                await new Promise<void>(
                    resolve => {
                        this.tweens.add({
                            targets: sprite,
                            x: target.x,
                            y: target.y,
                            duration,
                            ease: 'Sine.easeInOut',
                            onComplete: () =>
                                resolve(),
                            onStop: () =>
                                resolve(),
                        });
                    }
                );
            }

            if (move.captures.length) {
                for (const capture of move.captures) {
                    const victim = this.sprites.get(
                        capture.victimId
                    );

                    if (!victim) continue;

                    const effect = this.add
                        .text(
                            sprite.x,
                            sprite.y - 34,
                            'POOF!',
                            {
                                fontSize: '22px',
                                color: '#fbbf24',
                                fontStyle: 'bold',
                            }
                        )
                        .setOrigin(0.5);

                    await new Promise<void>(
                        resolve => {
                            this.tweens.add({
                                targets: victim,
                                alpha: 0,
                                scale: 0.2,
                                duration: 360,
                                onComplete: () => {
                                    effect.destroy();
                                    resolve();
                                },
                                onStop: () => {
                                    effect.destroy();
                                    resolve();
                                },
                            });
                        }
                    );
                }
            }

            if (move.pieceHome) {
                const effect = this.add
                    .text(
                        sprite.x,
                        sprite.y - 35,
                        'HOME!',
                        {
                            fontSize: '22px',
                            fontStyle: 'bold',
                            color: '#fbbf24',
                        }
                    )
                    .setOrigin(0.5);

                this.time.delayedCall(
                    600,
                    () => effect.destroy()
                );
            }
        } finally {
            this.animating = false;
        }
    }
}
