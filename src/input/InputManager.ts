import Phaser from 'phaser';

/**
 * Returns true if the current device is (or should be treated as) a touch device.
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    localStorage.getItem('touchMode') === '1'
  );
}

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;       // just-pressed this frame
  jumpHeld: boolean;   // held down
  attack: boolean;     // just-pressed
  dodge: boolean;      // just-pressed
}

type TouchState = { left: boolean; right: boolean; jump: boolean; attack: boolean; dodge: boolean };

export class InputManager {
  // Touch state — ALWAYS tracked regardless of isMobile check.
  // VirtualControlsScene sets registry 'touchInput'; we read it every frame.
  private touchState: TouchState     = { left: false, right: false, jump: false, attack: false, dodge: false };
  private prevTouchState: TouchState = { left: false, right: false, jump: false, attack: false, dodge: false };

  constructor(_scene: Phaser.Scene) {}

  public isMobileDevice(): boolean {
    return isTouchDevice();
  }

  public getState(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keyW: Phaser.Input.Keyboard.Key,
    keyA: Phaser.Input.Keyboard.Key,
    keyD: Phaser.Input.Keyboard.Key,
    keyX: Phaser.Input.Keyboard.Key,
    keyC: Phaser.Input.Keyboard.Key,
    scene: Phaser.Scene,
  ): InputState {
    // ALWAYS read touch state from registry — don't gate on isMobile.
    // This way even if isTouchDevice() returned false at startup, touch still works.
    this.prevTouchState = { ...this.touchState };
    const ts = scene.registry.get('touchInput') as TouchState | undefined;
    if (ts) {
      this.touchState = { ...ts };
    }

    const leftDown  = cursors.left.isDown  || keyA.isDown  || this.touchState.left;
    const rightDown = cursors.right.isDown || keyD.isDown  || this.touchState.right;
    const jumpHeld  = cursors.space.isDown || cursors.up.isDown || keyW.isDown || this.touchState.jump;

    const jumpJust =
      Phaser.Input.Keyboard.JustDown(cursors.space) ||
      Phaser.Input.Keyboard.JustDown(cursors.up)    ||
      Phaser.Input.Keyboard.JustDown(keyW)           ||
      (this.touchState.jump && !this.prevTouchState.jump);

    const attackJust =
      Phaser.Input.Keyboard.JustDown(keyX) ||
      (this.touchState.attack && !this.prevTouchState.attack);

    const dodgeJust =
      Phaser.Input.Keyboard.JustDown(keyC) ||
      (this.touchState.dodge && !this.prevTouchState.dodge);

    return { left: leftDown, right: rightDown, jump: jumpJust, jumpHeld, attack: attackJust, dodge: dodgeJust };
  }
}
