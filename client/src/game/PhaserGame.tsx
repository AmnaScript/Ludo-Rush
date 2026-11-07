import { useEffect, useRef } from 'react';
import Phaser from 'phaser';

/** Phase 0 Phaser smoke test, not the N-player ring board (Phase 2). */
export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    class WelcomeScene extends Phaser.Scene {
      constructor() { super('Welcome'); }
      create() {
        const { width, height } = this.scale;
        const g = this.add.graphics();
        g.lineStyle(2, 0x5b5d83, 0.8);
        g.strokeCircle(width / 2, height / 2, 116);
        g.lineStyle(2, 0x5b5d83, 0.35);
        g.strokeCircle(width / 2, height / 2, 82);
        for (let i = 0; i < 8; i += 1) {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const x = width / 2 + Math.cos(angle) * 116;
          const y = height / 2 + Math.sin(angle) * 116;
          g.fillStyle(Phaser.Display.Color.HSLToColor(i / 8, 0.75, 0.64).color, 1);
          g.fillCircle(x, y, 12);
        }
        this.add.text(width / 2, height / 2 - 14, 'LUDO', { fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
        this.add.text(width / 2, height / 2 + 20, 'RUSH', { fontFamily: 'Arial', fontSize: '27px', fontStyle: 'bold', color: '#f0bb65' }).setOrigin(0.5);
      }
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 440,
      height: 360,
      parent: containerRef.current,
      backgroundColor: '#1a1c31',
      scene: WelcomeScene,
      render: { antialias: true },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    });
    return () => { game.destroy(true); };
  }, []);
  return <div ref={containerRef} className="h-[360px] w-full overflow-hidden rounded-2xl" aria-label="Phaser canvas smoke test" />;
}
