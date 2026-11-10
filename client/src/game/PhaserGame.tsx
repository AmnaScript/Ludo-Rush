
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import Phaser from 'phaser';

import { BoardScene } from './scenes/BoardScene';

export interface PhaserGameHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
}

interface Props {
  playerCount: number;
}

export const PhaserGame = forwardRef<
  PhaserGameHandle,
  Props
>(function PhaserGame(
  { playerCount },
  ref
) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const gameRef =
    useRef<Phaser.Game | null>(null);

  const sceneRef =
    useRef<BoardScene | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () =>
        sceneRef.current?.zoomBy(1.2),

      zoomOut: () =>
        sceneRef.current?.zoomBy(1 / 1.2),

      resetView: () =>
        sceneRef.current?.resetView(),
    }),
    []
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const parent = containerRef.current;

    const scene = new BoardScene();

    scene.setPlayerCount(playerCount);

    sceneRef.current = scene;

    const game = new Phaser.Game({
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

    gameRef.current = game;

    const observer = new ResizeObserver(() => {
      if (gameRef.current !== game) return;

      const width = Math.max(
        1,
        parent.clientWidth
      );

      const height = Math.max(
        1,
        parent.clientHeight
      );

      game.scale.resize(
        width,
        height
      );
    });

    observer.observe(parent);

    return () => {
      observer.disconnect();

      gameRef.current = null;
      sceneRef.current = null;

      game.destroy(true);
    };
    // The scene is created once.
    // Slider updates are handled below.
  }, []);

  useEffect(() => {
    sceneRef.current?.setPlayerCount(
      playerCount
    );
  }, [playerCount]);

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
      aria-label={`Interactive circular Ludo board for ${playerCount} players`}
      role="img"
    />
  );
});
