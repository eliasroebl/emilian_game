import Phaser from 'phaser';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PauseScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Dark overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5);

    // Pause text
    this.add.text(width / 2, 200, 'PAUSE', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Resume button
    const resumeButton = this.add.rectangle(width / 2, 350, 240, 60, 0x4CAF50);
    resumeButton.setInteractive({ useHandCursor: true });

    this.add.text(width / 2, 350, 'Fortsetzen', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    resumeButton.on('pointerover', () => resumeButton.setFillStyle(0x66BB6A));
    resumeButton.on('pointerout', () => resumeButton.setFillStyle(0x4CAF50));
    resumeButton.on('pointerdown', () => this.resumeGame());

    // Menu button
    const menuButton = this.add.rectangle(width / 2, 430, 240, 60, 0x2196F3);
    menuButton.setInteractive({ useHandCursor: true });

    this.add.text(width / 2, 430, 'Hauptmenü', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    menuButton.on('pointerover', () => menuButton.setFillStyle(0x42A5F5));
    menuButton.on('pointerout', () => menuButton.setFillStyle(0x2196F3));
    menuButton.on('pointerdown', () => this.returnToMenu());

    // ESC to resume
    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
  }

  private resumeGame(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  private returnToMenu(): void {
    this.registry.set('lives', 3);
    this.registry.set('health', 100);
    this.registry.set('score', 0);
    this.registry.set('attackBoost', 1);
    this.registry.set('defenseBoost', 1);

    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('MenuScene');
    this.scene.stop();
  }
}
