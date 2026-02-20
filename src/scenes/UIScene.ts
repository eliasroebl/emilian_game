import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';

export class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // Player name display
    const playerName = (this.registry.get('playerName') as string) || 'Held';
    this.add.text(16, 16, playerName, {
      fontSize: '20px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });

    // Health bar background
    const healthBarBg = this.add.graphics();
    healthBarBg.fillStyle(0x000000, 0.5);
    healthBarBg.fillRect(16, 45, 204, 24);

    // Health bar
    this.healthBar = this.add.graphics();

    // Health text (create before updateHealthBar)
    this.healthText = this.add.text(118, 57, '100/100', {
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.healthText.setOrigin(0.5);

    // Now update the health bar
    this.updateHealthBar(100, 100);

    // Lives display
    this.livesText = this.add.text(16, 80, '❤️ x 3', {
      fontSize: '18px',
      color: '#ff6b6b',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.updateLives((this.registry.get('lives') as number) || 3);

    // Score display
    this.scoreText = this.add.text(784, 16, 'Punkte: 0', {
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.scoreText.setOrigin(1, 0);

    // World name display
    const worldConfig = GAME_CONFIG.WORLDS.EARTH;
    const worldText = this.add.text(400, 16, worldConfig.name, {
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    worldText.setOrigin(0.5, 0);

    // Controls hint (bottom)
    const controlsHint = this.add.text(400, 580, 'Pfeiltasten/WASD: Bewegen | SPACE: Springen | Wand berühren + SPACE: Wandsprung | X: Angriff | C: Ausweichen', {
      fontSize: '11px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    });
    controlsHint.setOrigin(0.5);

    // Listen for game events
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const gameScene = this.scene.get('GameScene');

    // Health updates
    gameScene.events.on('playerDamaged', (health: number, maxHealth: number) => {
      this.updateHealthBar(health, maxHealth);
    });

    gameScene.events.on('playerHealed', (health: number, maxHealth: number) => {
      this.updateHealthBar(health, maxHealth);
    });

    // Lives updates
    gameScene.events.on('livesUpdated', (lives: number) => {
      this.updateLives(lives);
    });

    // Score updates
    gameScene.events.on('scoreUpdated', (score: number) => {
      this.updateScore(score);
    });
  }

  private updateHealthBar(health: number, maxHealth: number): void {
    this.healthBar.clear();

    // Border
    this.healthBar.lineStyle(2, 0xffffff, 1);
    this.healthBar.strokeRect(16, 45, 204, 24);

    // Health fill
    const healthPercent = health / maxHealth;
    let color = 0x00ff00; // Green

    if (healthPercent < 0.3) {
      color = 0xff0000; // Red
    } else if (healthPercent < 0.6) {
      color = 0xffff00; // Yellow
    }

    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(18, 47, 200 * healthPercent, 20);

    // Update text
    this.healthText.setText(`${health}/${maxHealth}`);
  }

  private updateLives(lives: number): void {
    let heartsDisplay = '';
    for (let i = 0; i < lives; i++) {
      heartsDisplay += '❤️';
    }
    this.livesText.setText(heartsDisplay || '💀');
  }

  private updateScore(score: number): void {
    this.scoreText.setText(`Punkte: ${score}`);

    // Pop animation
    this.tweens.add({
      targets: this.scoreText,
      scale: 1.2,
      duration: 100,
      yoyo: true,
    });
  }
}
