import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load minimal assets needed for the loading screen
  }

  create(): void {
    // Initialize any game-wide settings here
    if (new URLSearchParams(window.location.search).get('test') === '1') {
      // Skip menu/preload flow and go directly to PreloadScene → TestScene
      this.registry.set('__testMode', true);
    }
    this.scene.start('PreloadScene');
  }
}
