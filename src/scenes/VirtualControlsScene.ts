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

    // Allow this scene to receive input even when running in parallel with GameScene.
    // setTopOnly(false) means ALL scenes receive the same pointer events (not just topmost).
    this.input.setTopOnly(false);

    // Enable multi-touch
    this.input.addPointer(3);

    for (const cfg of BUTTONS) {
      this.createButton(cfg);
    }
  }

  private createButton(cfg: ButtonConfig): void {
    const { key, x, y, radius, alpha, color, label } = cfg;

    // Draw the visual (graphics + text) — NOT interactive themselves
    const gfx = this.add.graphics();
    gfx.setScrollFactor(0);
    gfx.setDepth(100);
    gfx.setAlpha(alpha);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(x, y, radius);
    gfx.lineStyle(3, 0xffffff, 0.6);
    gfx.strokeCircle(x, y, radius);

    const txt = this.add.text(x, y, label, {
      fontSize: `${Math.round(radius * 0.65)}px`,
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(101).setAlpha(alpha);

    // Invisible Zone as the actual hit target — much more reliable than Container
    const zone = this.add.zone(x, y, radius * 2, radius * 2);
    zone.setScrollFactor(0);
    zone.setDepth(102);
    zone.setInteractive({ useHandCursor: false });

    const setKey = (val: boolean) => {
      const current = (this.registry.get('touchInput') as Record<string, boolean>) || {};
      this.registry.set('touchInput', { ...current, [key]: val });
    };

    zone.on('pointerdown', () => {
      setKey(true);
      gfx.setAlpha(Math.min(alpha + 0.3, 1.0));
      txt.setAlpha(1.0);
      txt.setScale(0.9);
    });

    const release = () => {
      setKey(false);
      gfx.setAlpha(alpha);
      txt.setAlpha(alpha);
      txt.setScale(1.0);
    };

    zone.on('pointerup', release);
    zone.on('pointerout', release);
  }
}
