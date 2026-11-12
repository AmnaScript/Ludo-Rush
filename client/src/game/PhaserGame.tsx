
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import Phaser from 'phaser';

import type {
  GameState,
  MoveResult,
} from '@ludo-rush/shared';

import {
  BoardScene,
} from './scenes/BoardScene';

export interface PhaserGameHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  playMove: (
    move: MoveResult
  ) => Promise<void>;
}

interface Props {
  playerCount: number;
  game: GameState | null;
  validPieceIds: string[];
  onPieceClick: (pieceId: string) => void;
}

export const PhaserGame = forwardRef<
  PhaserGameHandle,
  Props
>(function PhaserGame(
  {
    playerCount,
    game,
    validPieceIds,
    onPieceClick,
  },
  ref
) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const gameRef =
    useRef<Phaser.Game | null>(null);

  const sceneRef =
    useRef<BoardScene | null>(null);

  const pickRef = useRef(onPieceClick);
  pickRef.current = onPieceClick;

  const snapshotRef = useRef({
    playerCount,
    game,
    validPieceIds,
  });

  snapshotRef.current = {
    playerCount,
    game,
    validPieceIds,
  };

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () =>
        sceneRef.current?.zoomBy(1.2),

      zoomOut: () =>
        sceneRef.current?.zoomBy(
          1 / 1.2
        ),

      resetView: () =>
        sceneRef.current?.resetView(),

      playMove: async move => {
        await sceneRef.current?.animateMove(
          move
        );
      },
    }),
    []
  );

  useEffect(() => {
    const parent = containerRef.current;

    if (!parent) return;

    const scene = new BoardScene();

    const initial = snapshotRef.current;

    scene.setPlayerCount(
      initial.playerCount
    );

    scene.setGame(
      initial.game,
      initial.validPieceIds,
      id => pickRef.current(id)
    );

    sceneRef.current = scene;

    const phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: Math.max(
        parent.clientWidth,
        320
      ),
      height: Math.max(
        parent.clientHeight,
        360
      ),
      backgroundColor: '#111527',
      render: {
        antialias: true,
      },
      scale: {
        mode: Phaser.Scale.NONE,
      },
      scene: [scene],
    });

    gameRef.current = phaserGame;

    const observer = new ResizeObserver(
      () => {
        if (
          gameRef.current !== phaserGame
        ) {
          return;
        }

        phaserGame.scale.resize(
          Math.max(
            1,
            parent.clientWidth
          ),
          Math.max(
            1,
            parent.clientHeight
          )
        );
      }
    );

    observer.observe(parent);

    return () => {
      observer.disconnect();

      gameRef.current = null;
      sceneRef.current = null;

      phaserGame.destroy(true);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) return;

    if (!game) {
      scene.setGame(
        null,
        [],
        id => pickRef.current(id)
      );

      scene.setPlayerCount(playerCount);
    } else {
      scene.setGame(
        game,
        validPieceIds,
        id => pickRef.current(id)
      );
    }
  }, [
    playerCount,
    game,
    validPieceIds,
  ]);

  return (
    <div
      ref={containerRef}
      className="
        h-[440px]
        w-full
        touch-none
        overflow-hidden
        rounded-2xl
        bg-[#111527]
        sm:h-[600px]
        lg:h-[700px]
      "
      aria-label={`Playable Ludo board for ${playerCount} players`}
    />
  );
});
