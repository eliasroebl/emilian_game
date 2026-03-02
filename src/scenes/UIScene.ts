import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';

export class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  // Agent 4: coin counter
  private coinText!: Phaser.GameObjects.Text;
  // Progress bar
  private progressBar!: Phaser.GameObjects.Graphics;
  private readonly WORLD_WIDTH = 12000;
  // Boost indicators
  private boostBar!: Phaser.GameObjects.Graphics;
  private attackBoostEnd: number = 0;   // scene time when attack boost expires
  private defenseBoostEnd: number = 0;  // scene time when defense boost expires
  private attackBoostDur: number = 0;   // total duration for fill ratio
  private defenseBoostDur: number = 0;

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

    // Agent 4: Coin counter below score
    const totalCoins = (this.registry.get('totalCoins') as number) || 0;
    this.coinText = this.add.text(784, 45, `🪙 0/${totalCoins}`, {
      fontSize: '18px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.coinText.setOrigin(1, 0);

    // World name display
    const worldConfig = GAME_CONFIG.WORLDS.EARTH;
    const worldText = this.add.text(400, 16, worldConfig.name, {
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    worldText.setOrigin(0.5, 0);

    // Agent 4: Controls hint — hide on mobile/touch devices
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      typeof navigator !== 'undefined' ? navigator.userAgent : ''
    );
    if (!isMobile) {
      const controlsHint = this.add.text(400, 578, 'Pfeiltasten/WASD: Bewegen | SPACE: Springen | Wand berühren + SPACE: Wandsprung | X: Angriff | C: Ausweichen', {
        fontSize: '11px',
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 2,
      });
      controlsHint.setOrigin(0.5);
    }

    // Boost indicator bar (drawn each frame in update)
    this.boostBar = this.add.graphics();

    // ── Progress bar (bottom strip) ─────────────────────────────────────────
    // Dark background strip
    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x000000, 0.6);
    progressBg.fillRect(0, 591, 800, 9);
    // Green progress bar (starts empty)
    this.progressBar = this.add.graphics();
    // Label
    this.add.text(400, 594, '▶', {
      fontSize: '8px',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setAlpha(0.5);

    // Fullscreen button (bottom-right corner)
    this.createFullscreenButton();

    // Listen for game events
    this.setupEventListeners();
  }

  update(): void {
    // Update progress bar from GameScene player position
    try {
      const gameScene = this.scene.get('GameScene') as Phaser.Scene & { player?: { x: number } };
      if (gameScene && gameScene.player) {
        const px = Math.max(0, Math.min(gameScene.player.x, this.WORLD_WIDTH));
        const barWidth = (px / this.WORLD_WIDTH) * 800;
        this.progressBar.clear();
        this.progressBar.fillStyle(0x44ff44, 1);
        this.progressBar.fillRect(0, 592, barWidth, 6);
        // Player position marker
        this.progressBar.fillStyle(0xffffff, 1);
        this.progressBar.fillRect(barWidth - 2, 591, 4, 8);
      }
    } catch {
      // GameScene might not be ready yet
    }

    // Draw active boost indicators
    this.drawBoostBars();
  }

  private drawBoostBars(): void {
    this.boostBar.clear();
    const now = this.time.now;
    const barX = 16;
    const barW = 120;
    const barH = 8;
    let y = 105; // below lives display

    // Attack boost
    if (this.attackBoostEnd > now && this.attackBoostDur > 0) {
      const remaining = (this.attackBoostEnd - now) / this.attackBoostDur;
      // Background
      this.boostBar.fillStyle(0x000000, 0.5);
      this.boostBar.fillRect(barX, y, barW, barH);
      // Fill (orange)
      this.boostBar.fillStyle(0xff9900, 0.9);
      this.boostBar.fillRect(barX, y, barW * remaining, barH);
      // Border
      this.boostBar.lineStyle(1, 0xffffff, 0.6);
      this.boostBar.strokeRect(barX, y, barW, barH);
      y += barH + 4;
    }

    // Defense boost
    if (this.defenseBoostEnd > now && this.defenseBoostDur > 0) {
      const remaining = (this.defenseBoostEnd - now) / this.defenseBoostDur;
      // Background
      this.boostBar.fillStyle(0x000000, 0.5);
      this.boostBar.fillRect(barX, y, barW, barH);
      // Fill (blue)
      this.boostBar.fillStyle(0x66aaff, 0.9);
      this.boostBar.fillRect(barX, y, barW * remaining, barH);
      // Border
      this.boostBar.lineStyle(1, 0xffffff, 0.6);
      this.boostBar.strokeRect(barX, y, barW, barH);
    }
  }

  private createFullscreenButton(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // iOS Safari blocks requestFullscreen — detect it
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = ('standalone' in navigator) && (navigator as unknown as { standalone: boolean }).standalone;

    // Already fullscreen as PWA — no button needed
    if (isStandalone) return;

    const btn = this.add.text(width - 16, height - 16, '⛶', {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 1).setScrollFactor(0).setInteractive({ useHandCursor: true }).setAlpha(0.7).setDepth(200);

    btn.on('pointerover', () => btn.setAlpha(1));
    btn.on('pointerout', () => btn.setAlpha(0.7));
    btn.on('pointerdown', () => {
      if (isIOS) {
        // Show iOS "Add to Home Screen" instructions overlay
        this.showIOSFullscreenHint();
      } else if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
        btn.setText('⛶');
      } else {
        this.scale.startFullscreen();
        btn.setText('✕');
      }
    });
  }

  private showIOSFullscreenHint(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    const overlay = this.add.rectangle(w / 2, h / 2, w - 40, 180, 0x000000, 0.88)
      .setScrollFactor(0).setDepth(300).setInteractive();

    const text = this.add.text(w / 2, h / 2, [
      '📱 Vollbild auf iPhone:',
      '',
      'Teilen  →  Zum Home-Bildschirm',
      '',
      '(Dann als App öffnen → echtes Vollbild)',
      '',
      'Tippen zum Schließen',
    ].join('\n'), {
      fontSize: '14px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    const close = () => { overlay.destroy(); text.destroy(); };
    overlay.on('pointerdown', close);
    this.time.delayedCall(5000, close);
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

    // Agent 4: Coin collection updates
    gameScene.events.on('coinCollected', (collected: number, total: number) => {
      this.coinText.setText(`🪙 ${collected}/${total}`);
    });

    // Init coin display when totalCoins is known
    const totalCoins = (this.registry.get('totalCoins') as number) || 0;
    if (totalCoins > 0) {
      this.coinText.setText(`🪙 0/${totalCoins}`);
    }

    // Boost start/end events
    gameScene.events.on('boostStart', (type: string, duration: number) => {
      const end = this.time.now + duration;
      if (type === 'attack') {
        this.attackBoostEnd = end;
        this.attackBoostDur = duration;
      } else if (type === 'defense') {
        this.defenseBoostEnd = end;
        this.defenseBoostDur = duration;
      }
    });

    gameScene.events.on('boostEnd', (type: string) => {
      if (type === 'attack') {
        this.attackBoostEnd = 0;
      } else if (type === 'defense') {
        this.defenseBoostEnd = 0;
      }
    });

    // Cleanup on shutdown
    this.events.on('shutdown', () => {
      gameScene.events.off('playerDamaged');
      gameScene.events.off('playerHealed');
      gameScene.events.off('livesUpdated');
      gameScene.events.off('scoreUpdated');
      gameScene.events.off('coinCollected');
      gameScene.events.off('boostStart');
      gameScene.events.off('boostEnd');
      this.tweens.killAll();
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
