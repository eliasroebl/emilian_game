/**
 * VirtualControlsScene
 * - Left side: analog joystick (replaces separate ◀ ▶ buttons)
 * - Right side: Jump (A), Attack (⚔), Dodge (💨) buttons
 * - All elements positioned above iPhone safe-area / Android nav bar
 * - Activated when isTouchDevice() or forceTouchMode registry flag is set
 */
import Phaser from 'phaser';
import { isTouchDevice } from '../input/InputManager';

// ── Layout constants ─────────────────────────────────────────────────────────
// Canvas is 800×600. Controls sit in the bottom ~100px.
// We leave 30px of extra bottom margin to clear iPhone home indicator.
const BOTTOM_MARGIN = 38;           // px from canvas bottom
const CANVAS_H      = 600;

// Joystick (left side)
const JS_X          = 95;           // centre x
const JS_Y          = CANVAS_H - BOTTOM_MARGIN - 45; // centre y
const JS_BASE_R     = 52;           // outer ring radius
const JS_THUMB_R    = 28;           // movable thumb radius
const JS_DEAD       = 0.25;         // dead-zone fraction of base radius
const JS_ALPHA      = 0.50;

// Right buttons
const BTN_JUMP   = { x: 740, y: CANVAS_H - BOTTOM_MARGIN - 50, r: 46, color: 0x225522, label: 'A'  };
const BTN_ATTACK = { x: 648, y: CANVAS_H - BOTTOM_MARGIN - 28, r: 34, color: 0x552222, label: '⚔' };
const BTN_DODGE  = { x: 556, y: CANVAS_H - BOTTOM_MARGIN - 16, r: 28, color: 0x553322, label: '💨' };

export class VirtualControlsScene extends Phaser.Scene {
  // Joystick state
  private jsPointerId: number = -1;
  private jsThumbGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'VirtualControlsScene' });
  }

  create(): void {
    const showControls = isTouchDevice() || this.registry.get('forceTouchMode') === true;
    if (!showControls) return;

    // Initialise registry
    this.registry.set('touchInput', {
      left: false, right: false, jump: false, attack: false, dodge: false,
    });

    // Allow parallel scene to receive pointer events
    this.input.setTopOnly(false);
    this.input.addPointer(3);

    this.createJoystick();
    this.createActionButton(BTN_JUMP,   'jump');
    this.createActionButton(BTN_ATTACK, 'attack');
    this.createActionButton(BTN_DODGE,  'dodge');

    // Clean up on shutdown
    this.events.on('shutdown', this.handleShutdown, this);
  }

  private handleShutdown(): void {
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointercancel');
    this.events.off('shutdown', this.handleShutdown, this);
  }

  // ── Joystick ───────────────────────────────────────────────────────────────

  private createJoystick(): void {
    // Static base ring
    const baseGfx = this.add.graphics();
    baseGfx.setScrollFactor(0).setDepth(100);
    this.drawBase(baseGfx, false);

    // Movable thumb
    this.jsThumbGfx = this.add.graphics();
    this.jsThumbGfx.setScrollFactor(0).setDepth(101);
    this.drawThumb(JS_X, JS_Y);

    // Large hit zone covering the whole joystick area
    const hitR = JS_BASE_R + 20;
    const zone = this.add.zone(JS_X, JS_Y, hitR * 2, hitR * 2);
    zone.setScrollFactor(0).setDepth(102).setInteractive();

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.jsPointerId = ptr.id;
      this.drawBase(baseGfx, true);
      this.updateJoystick(ptr.x, ptr.y);
    });

    // Track movement globally (finger may drift outside zone)
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.jsPointerId) return;
      this.updateJoystick(ptr.x, ptr.y);
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.jsPointerId) return;
      this.jsPointerId = -1;
      this.drawBase(baseGfx, false);
      this.drawThumb(JS_X, JS_Y);
      this.setKeys({ left: false, right: false });
    });

    this.input.on('pointercancel', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.jsPointerId) return;
      this.jsPointerId = -1;
      this.drawBase(baseGfx, false);
      this.drawThumb(JS_X, JS_Y);
      this.setKeys({ left: false, right: false });
    });
  }

  private updateJoystick(ptrX: number, ptrY: number): void {
    // Convert pointer position to camera/scene coordinates
    const cam = this.cameras.main;
    const sceneX = (ptrX - cam.x) / cam.zoom;
    const sceneY = (ptrY - cam.y) / cam.zoom;

    const dx = sceneX - JS_X;
    const dy = sceneY - JS_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(dist, JS_BASE_R);
    const angle   = Math.atan2(dy, dx);

    // Thumb position (clamped inside base)
    const tx = JS_X + Math.cos(angle) * clamped;
    const ty = JS_Y + Math.sin(angle) * clamped;
    this.drawThumb(tx, ty);

    // Determine left/right from normalised x offset
    const normX = dist > 0 ? dx / dist : 0;
    const fraction = clamped / JS_BASE_R;

    const left  = normX < -JS_DEAD && fraction > JS_DEAD;
    const right = normX >  JS_DEAD && fraction > JS_DEAD;
    this.setKeys({ left, right });
  }

  private drawBase(gfx: Phaser.GameObjects.Graphics, pressed: boolean): void {
    gfx.clear();
    gfx.fillStyle(0x334466, pressed ? JS_ALPHA + 0.15 : JS_ALPHA);
    gfx.fillCircle(JS_X, JS_Y, JS_BASE_R);
    gfx.lineStyle(2, 0xffffff, pressed ? 0.9 : 0.5);
    gfx.strokeCircle(JS_X, JS_Y, JS_BASE_R);
    // Directional cross-hair hints
    gfx.lineStyle(1, 0xffffff, 0.25);
    gfx.lineBetween(JS_X - JS_BASE_R + 6, JS_Y, JS_X + JS_BASE_R - 6, JS_Y);
    gfx.lineBetween(JS_X, JS_Y - JS_BASE_R + 6, JS_X, JS_Y + JS_BASE_R - 6);
  }

  private drawThumb(x: number, y: number): void {
    this.jsThumbGfx.clear();
    this.jsThumbGfx.fillStyle(0x6688bb, 0.9);
    this.jsThumbGfx.fillCircle(x, y, JS_THUMB_R);
    this.jsThumbGfx.lineStyle(2, 0xffffff, 0.8);
    this.jsThumbGfx.strokeCircle(x, y, JS_THUMB_R);
  }

  // ── Action buttons ─────────────────────────────────────────────────────────

  private createActionButton(
    cfg: { x: number; y: number; r: number; color: number; label: string },
    key: 'jump' | 'attack' | 'dodge',
  ): void {
    const { x, y, r, color, label } = cfg;
    const alpha = key === 'jump' ? 0.65 : 0.55;

    const gfx = this.add.graphics();
    gfx.setScrollFactor(0).setDepth(100);

    const draw = (pressed: boolean) => {
      gfx.clear();
      gfx.fillStyle(color, pressed ? Math.min(alpha + 0.25, 1) : alpha);
      gfx.fillCircle(x, y, r);
      gfx.lineStyle(pressed ? 3 : 2, 0xffffff, pressed ? 1 : 0.6);
      gfx.strokeCircle(x, y, r);
    };
    draw(false);

    const txt = this.add.text(x, y, label, {
      fontSize: `${Math.round(r * 0.65)}px`,
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    const zone = this.add.zone(x, y, r * 2.2, r * 2.2);
    zone.setScrollFactor(0).setDepth(102).setInteractive();

    const setKey = (val: boolean) => {
      this.setKeys({ [key]: val });
      draw(val);
      txt.setScale(val ? 0.88 : 1);
    };

    zone.on('pointerdown',   () => setKey(true));
    zone.on('pointerup',     () => setKey(false));
    zone.on('pointerout',    () => setKey(false));
    zone.on('pointercancel', () => setKey(false));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private setKeys(partial: Partial<Record<'left'|'right'|'jump'|'attack'|'dodge', boolean>>): void {
    const cur = (this.registry.get('touchInput') as Record<string, boolean>) || {};
    this.registry.set('touchInput', { ...cur, ...partial });
  }
}
