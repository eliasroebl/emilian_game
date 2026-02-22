import Phaser from 'phaser';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;       // just-pressed this frame
  jumpHeld: boolean;   // held down (for variable jump height)
  attack: boolean;     // just-pressed
  dodge: boolean;      // just-pressed
}

type TouchState = { left: boolean; right: boolean; jump: boolean; attack: boolean; dodge: boolean };

export class InputManager {
  private isMobile: boolean;

  // Touch state (set by VirtualControlsScene via registry)
  private touchState: TouchState = { left: false, right: false, jump: false, attack: false, dodge: false };
  private prevTouchState: TouchState = { left: false, right: false, jump: false, attack: false, dodge: false };

  constructor(_scene: Phaser.Scene) {
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  public isMobileDevice(): boolean {
    return this.isMobile;
  }

  /**
   * Called each frame by Player.
   * Merges keyboard input with any touch input coming from VirtualControlsScene
   * (stored in the game registry under the key 'touchInput').
   */
  public getState(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    keyW: Phaser.Input.Keyboard.Key,
    keyA: Phaser.Input.Keyboard.Key,
    keyD: Phaser.Input.Keyboard.Key,
    keyX: Phaser.Input.Keyboard.Key,
    keyC: Phaser.Input.Keyboard.Key,
    scene: Phaser.Scene,
  ): InputState {
    // Read touch state from registry (set by VirtualControlsScene)
    if (this.isMobile) {
      this.prevTouchState = { ...this.touchState };
      const ts = scene.registry.get('touchInput') as TouchState | undefined;
      if (ts) {
        this.touchState = { ...ts };
      }
    }

    const leftDown  = cursors.left.isDown  || keyA.isDown  || this.touchState.left;
    const rightDown = cursors.right.isDown || keyD.isDown  || this.touchState.right;
    const jumpHeld  = cursors.space.isDown || cursors.up.isDown || keyW.isDown || this.touchState.jump;

    const jumpJust =
      Phaser.Input.Keyboard.JustDown(cursors.space) ||
      Phaser.Input.Keyboard.JustDown(cursors.up) ||
      Phaser.Input.Keyboard.JustDown(keyW) ||
      (this.touchState.jump && !this.prevTouchState.jump);

    const attackJust =
      Phaser.Input.Keyboard.JustDown(keyX) ||
      (this.touchState.attack && !this.prevTouchState.attack);

    const dodgeJust =
      Phaser.Input.Keyboard.JustDown(keyC) ||
      (this.touchState.dodge && !this.prevTouchState.dodge);

    return {
      left: leftDown,
      right: rightDown,
      jump: jumpJust,
      jumpHeld,
      attack: attackJust,
      dodge: dodgeJust,
    };
  }

  public updateTouchState(state: Partial<TouchState>): void {
    this.touchState = { ...this.touchState, ...state };
  }
}
