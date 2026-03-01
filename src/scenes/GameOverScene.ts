import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Dark overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    // Game Over text
    const gameOverText = this.add.text(width / 2, 150, 'GAME OVER', {
      fontSize: '64px',
      color: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    gameOverText.setOrigin(0.5);

    // Player name
    const playerName = this.registry.get('playerName') || 'Held';
    this.add.text(width / 2, 230, `${playerName} ist gefallen!`, {
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Final score
    const score = this.registry.get('score') || 0;
    this.add.text(width / 2, 290, `Punkte: ${score}`, {
      fontSize: '32px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Restart button
    const restartButton = this.add.rectangle(width / 2, 400, 240, 60, 0x4CAF50);
    restartButton.setInteractive({ useHandCursor: true });

    const restartText = this.add.text(width / 2, 400, 'Nochmal spielen', {
      fontSize: '24px',
      color: '#ffffff',
    });
    restartText.setOrigin(0.5);

    restartButton.on('pointerover', () => restartButton.setFillStyle(0x66BB6A));
    restartButton.on('pointerout', () => restartButton.setFillStyle(0x4CAF50));
    restartButton.on('pointerdown', () => this.restartGame());

    // Menu button
    const menuButton = this.add.rectangle(width / 2, 480, 240, 60, 0x2196F3);
    menuButton.setInteractive({ useHandCursor: true });

    const menuText = this.add.text(width / 2, 480, 'Hauptmenü', {
      fontSize: '24px',
      color: '#ffffff',
    });
    menuText.setOrigin(0.5);

    menuButton.on('pointerover', () => menuButton.setFillStyle(0x42A5F5));
    menuButton.on('pointerout', () => menuButton.setFillStyle(0x2196F3));
    menuButton.on('pointerdown', () => this.returnToMenu());

    // Allow Enter to restart
    this.input.keyboard?.on('keydown-ENTER', () => this.restartGame());

    // Clean up on shutdown
    this.events.on('shutdown', this.handleShutdown, this);
  }

  private handleShutdown(): void {
    this.input.keyboard?.off('keydown-ENTER');
    this.events.off('shutdown', this.handleShutdown, this);
  }

  private restartGame(): void {
    // Reset game state
    this.registry.set('lives', 3);
    this.registry.set('health', 100);
    this.registry.set('score', 0);
    this.registry.set('attackBoost', 1);
    this.registry.set('defenseBoost', 1);

    this.scene.stop('UIScene');
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
    this.scene.stop();
  }

  private returnToMenu(): void {
    // Reset game state
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
