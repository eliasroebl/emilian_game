import Phaser from 'phaser';
import { isTouchDevice } from '../input/InputManager';

type TouchKey = 'left' | 'right' | 'jump' | 'attack' | 'dodge';

interface ButtonConfig {
  key: TouchKey;
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: number;
  label: string;
}

const BUTTONS: ButtonConfig[] = [
  { key: 'left',   x: 70,  y: 510, radius: 45, alpha: 0.55, color: 0x334466, label: '◀' },
  { key: 'right',  x: 180, y: 510, radius: 45, alpha: 0.55, color: 0x334466, label: '▶' },
  { key: 'jump',   x: 730, y: 490, radius: 50, alpha: 0.65, color: 0x225522, label: 'A' },
  { key: 'attack', x: 630, y: 520, radius: 40, alpha: 0.55, color: 0x552222, label: '⚔' },
  { key: 'dodge',  x: 530, y: 535, radius: 35, alpha: 0.50, color: 0x553322, label: '💨' },
];

export class VirtualControlsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VirtualControlsScene' });
  }

  create(): void {
    const isMobile = isTouchDevice() || this.registry.get('forceTouchMode') === true;
    if (!isMobile) return;

    // Ensure registry key exists
    if (!this.registry.get('touchInput')) {
      this.registry.set('touchInput', { left: false, right: false, jump: false, attack: false, dodge: false });
    }

    for (const cfg of BUTTONS) {
      this.createButton(cfg);
    }
  }

  private createButton(cfg: ButtonConfig): void {
    const { key, x, y, radius, alpha, color, label } = cfg;

    // Container — positioned at (x, y) in camera space
    const container = this.add.container(x, y);
    container.setScrollFactor(0);
    container.setAlpha(alpha);
    container.setDepth(100);

    // Background circle
    const gfx = this.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillCircle(0, 0, radius);
    gfx.lineStyle(3, 0xffffff, 0.6);
    gfx.strokeCircle(0, 0, radius);

    // Label text
    const txt = this.add.text(0, 0, label, {
      fontSize: `${Math.round(radius * 0.65)}px`,
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    container.add([gfx, txt]);

    // Make interactive using circle hit area
    container.setSize(radius * 2, radius * 2);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, radius),
      Phaser.Geom.Circle.Contains,
    );

    const setKey = (val: boolean) => {
      const current = (this.registry.get('touchInput') as Record<string, boolean>) || {};
      this.registry.set('touchInput', { ...current, [key]: val });
    };

    container.on('pointerdown', () => {
      setKey(true);
      container.setAlpha(Math.min(alpha + 0.25, 1.0));
      container.setScale(0.92);
    });

    const release = () => {
      setKey(false);
      container.setAlpha(alpha);
      container.setScale(1.0);
    };

    container.on('pointerup', release);
    container.on('pointerout', release);
  }
}
