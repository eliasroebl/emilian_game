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
  { key: 'left',   x: 60,  y: 555, radius: 38, alpha: 0.55, color: 0x334466, label: '◀' },
  { key: 'right',  x: 155, y: 555, radius: 38, alpha: 0.55, color: 0x334466, label: '▶' },
  { key: 'jump',   x: 745, y: 540, radius: 45, alpha: 0.65, color: 0x225522, label: 'A' },
  { key: 'attack', x: 650, y: 565, radius: 35, alpha: 0.55, color: 0x552222, label: '⚔' },
  { key: 'dodge',  x: 555, y: 572, radius: 30, alpha: 0.50, color: 0x553322, label: '💨' },
];

export class VirtualControlsScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VirtualControlsScene' });
  }

  create(): void {
    const showControls = isTouchDevice() || this.registry.get('forceTouchMode') === true;
    if (!showControls) return;

    // Ensure registry key exists
    this.registry.set('touchInput', {
      left: false, right: false, jump: false, attack: false, dodge: false,
    });

    // Critical: allow this parallel scene to receive pointer input
    this.input.setTopOnly(false);
    this.input.addPointer(3); // support up to 4 simultaneous touches

    for (const cfg of BUTTONS) {
      this.createButton(cfg);
    }
  }

  private createButton(cfg: ButtonConfig): void {
    const { key, x, y, radius, alpha, color, label } = cfg;

    // --- Visual layer (graphics + text) ---
    const gfx = this.add.graphics();
    gfx.setScrollFactor(0).setDepth(100);

    const drawButton = (pressed: boolean) => {
      gfx.clear();
      gfx.fillStyle(color, pressed ? 1.0 : alpha);
      gfx.fillCircle(x, y, radius);
      gfx.lineStyle(pressed ? 4 : 2, 0xffffff, pressed ? 1.0 : 0.6);
      gfx.strokeCircle(x, y, radius);
    };
    drawButton(false);

    const txt = this.add.text(x, y, label, {
      fontSize: `${Math.round(radius * 0.65)}px`,
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // --- Hit zone (invisible, on top) ---
    // Use a Rectangle zone — simpler and more reliable than Circle on mobile
    const zone = this.add.zone(x, y, radius * 2.2, radius * 2.2);
    zone.setScrollFactor(0).setDepth(102);
    zone.setInteractive();

    const setKey = (val: boolean) => {
      const cur = (this.registry.get('touchInput') as Record<string, boolean>) || {};
      this.registry.set('touchInput', { ...cur, [key]: val });
      drawButton(val);
      txt.setScale(val ? 0.88 : 1.0);
    };

    zone.on('pointerdown',  () => setKey(true));
    zone.on('pointerup',    () => setKey(false));
    zone.on('pointerout',   () => setKey(false));
    zone.on('pointercancel',() => setKey(false));
  }
}
