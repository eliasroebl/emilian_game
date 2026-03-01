import Phaser from 'phaser';
import { isTouchDevice } from '../input/InputManager';

export class MenuScene extends Phaser.Scene {
  private playerName: string = '';
  private nameInput: HTMLInputElement | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Background
    this.add.tileSprite(0, 0, width * 2, height * 2, 'bg-green');

    // ── Animated background walking enemies ─────────────────────────────────
    this.spawnMenuEnemies(width, height);

    // ── Title with bob tween ─────────────────────────────────────────────────
    const title = this.add.text(width / 2, 100, 'Krone des Gingers', {
      fontSize: '48px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);
    // Gentle bob animation
    this.tweens.add({
      targets: title,
      y: 92,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Subtitle
    const subtitle = this.add.text(width / 2, 160, 'Ein episches Abenteuer', {
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    subtitle.setOrigin(0.5);

    // ── Highscore display ────────────────────────────────────────────────────
    const savedHighscore = parseInt(localStorage.getItem('highscore') || '0', 10);
    if (savedHighscore > 0) {
      const hsText = this.add.text(width / 2, 198, `🏆 Highscore: ${savedHighscore}`, {
        fontSize: '18px',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 3,
      });
      hsText.setOrigin(0.5);
    }

    // Name input label
    const nameLabel = this.add.text(width / 2, 245, 'Dein Name:', {
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    nameLabel.setOrigin(0.5);

    // Create HTML input for name
    this.createNameInput(width / 2, 285);

    // ── Start button with pulse tween ────────────────────────────────────────
    const startButton = this.add.rectangle(width / 2, 390, 200, 60, 0x4CAF50);
    startButton.setInteractive({ useHandCursor: true });

    const startText = this.add.text(width / 2, 390, 'Spiel starten', {
      fontSize: '24px',
      color: '#ffffff',
    });
    startText.setOrigin(0.5);

    // Pulse animation on button + text
    this.tweens.add({
      targets: [startButton, startText],
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Button hover effects
    startButton.on('pointerover', () => {
      startButton.setFillStyle(0x66BB6A);
    });

    startButton.on('pointerout', () => {
      startButton.setFillStyle(0x4CAF50);
    });

    startButton.on('pointerdown', () => {
      this.startGame();
    });

    // Controls info — context-aware for mobile vs desktop
    const isMobile = isTouchDevice() || localStorage.getItem('touchMode') === '1';
    const controlsStr = isMobile
      ? 'Touch-Steuerung:\n◀ ▶ Bewegen  |  A Springen\n⚔ Angreifen  |  💨 Ausweichen\nWand berühren + A = Wandsprung!'
      : 'Steuerung:\nPfeiltasten / WASD - Bewegen  |  LEERTASTE - Springen\nX - Angreifen  |  C - Ausweichen  |  Wand + LEERTASTE = Wandsprung!';
    const controlsText = this.add.text(width / 2, 470, controlsStr, {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2,
    });
    controlsText.setOrigin(0.5);

    // Touch mode toggle button
    this.createTouchToggle(width / 2, 535);

    // Fullscreen button (bottom-right corner)
    this.createFullscreenButton(width, height);

    // Allow Enter key to start game
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.startGame();
    });
  }

  // ── Animated walking enemies in the background ───────────────────────────────

  private spawnMenuEnemies(width: number, height: number): void {
    // Spawn 3 enemies that walk across the background at ground level
    const enemyData = [
      { key: 'mushroom-idle', anim: 'mushroom-run-anim', startX: -60, y: height - 80, speed: 40, delay: 0 },
      { key: 'chicken-idle',  anim: 'chicken-run-anim',  startX: -160, y: height - 85, speed: 55, delay: 1200 },
      { key: 'radish-idle',   anim: 'radish-run-anim',   startX: -100, y: height - 78, speed: 35, delay: 2500 },
    ];

    enemyData.forEach(({ key, anim, startX, y, speed, delay }) => {
      this.time.delayedCall(delay, () => {
        const sprite = this.add.sprite(startX, y, key);
        sprite.setScale(2);
        sprite.setAlpha(0.5);
        sprite.setDepth(0);
        if (this.anims.exists(anim)) {
          sprite.play(anim);
        }

        this.tweens.add({
          targets: sprite,
          x: width + 80,
          duration: (width + 140) / speed * 1000,
          repeat: -1,
          onRepeat: () => {
            sprite.x = startX;
          },
        });
      });
    });
  }

  private createTouchToggle(x: number, y: number): void {
    // Determine initial state: hardware detection OR localStorage override
    const autoDetected = isTouchDevice();
    const localStored = localStorage.getItem('touchMode') === '1';
    const initialActive = autoDetected || localStored;

    // Set registry
    this.registry.set('forceTouchMode', initialActive);

    const getLabel = (active: boolean) =>
      active ? '📱 Touch-Modus: AN' : '📱 Touch-Modus: AUS';
    const getColor = (active: boolean) =>
      active ? '#00cc44' : '#888888';

    const btn = this.add.text(x, y, getLabel(initialActive), {
      fontSize: '18px',
      color: getColor(initialActive),
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000066',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setAlpha(0.85));
    btn.on('pointerout', () => btn.setAlpha(1));

    btn.on('pointerdown', () => {
      const current = this.registry.get('forceTouchMode') === true;
      const next = !current;
      this.registry.set('forceTouchMode', next);
      localStorage.setItem('touchMode', next ? '1' : '0');
      btn.setText(getLabel(next));
      btn.setStyle({ color: getColor(next) });
    });
  }

  private createFullscreenButton(width: number, height: number): void {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = ('standalone' in navigator) && (navigator as unknown as { standalone: boolean }).standalone;
    if (isStandalone) return;

    const btn = this.add.text(width - 16, height - 16, '⛶', {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 1).setScrollFactor(0).setInteractive({ useHandCursor: true }).setAlpha(0.7);

    btn.on('pointerover', () => btn.setAlpha(1));
    btn.on('pointerout', () => btn.setAlpha(0.7));
    btn.on('pointerdown', () => {
      if (isIOS) {
        this.showIOSHint(width, height);
      } else if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
        btn.setText('⛶');
      } else {
        this.scale.startFullscreen();
        btn.setText('✕');
      }
    });
  }

  private showIOSHint(w: number, h: number): void {
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
      fontSize: '14px', color: '#ffffff', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    const close = () => { overlay.destroy(); text.destroy(); };
    overlay.on('pointerdown', close);
    this.time.delayedCall(5000, close);
  }

  private createNameInput(x: number, y: number): void {
    // Create an HTML input element
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Held';
    this.nameInput.maxLength = 20;
    this.nameInput.style.cssText = `
      position: absolute;
      width: 200px;
      height: 40px;
      font-size: 18px;
      text-align: center;
      border: 3px solid #4CAF50;
      border-radius: 8px;
      outline: none;
      background: rgba(255, 255, 255, 0.9);
    `;

    // Position the input
    const canvas = this.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / this.cameras.main.width;
    const scaleY = canvasRect.height / this.cameras.main.height;

    this.nameInput.style.left = `${canvasRect.left + (x - 100) * scaleX}px`;
    this.nameInput.style.top = `${canvasRect.top + y * scaleY}px`;
    this.nameInput.style.width = `${200 * scaleX}px`;
    this.nameInput.style.height = `${40 * scaleY}px`;

    document.body.appendChild(this.nameInput);
    this.nameInput.focus();

    // Update position on resize
    this.scale.on('resize', () => {
      if (this.nameInput) {
        const rect = canvas.getBoundingClientRect();
        const sx = rect.width / this.cameras.main.width;
        const sy = rect.height / this.cameras.main.height;
        this.nameInput.style.left = `${rect.left + (x - 100) * sx}px`;
        this.nameInput.style.top = `${rect.top + y * sy}px`;
      }
    });
  }

  private sanitizeName(raw: string): string {
    // Allow only alphanumeric, spaces, hyphens, underscores
    return raw.replace(/[^a-zA-Z0-9äöüÄÖÜß \-_]/g, '').trim().slice(0, 20);
  }

  private startGame(): void {
    // Get and sanitize player name
    const rawName = this.nameInput?.value ?? '';
    this.playerName = this.sanitizeName(rawName) || 'Held';

    // Remove the input element
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }

    // Store player name in registry for access in other scenes
    this.registry.set('playerName', this.playerName);
    this.registry.set('currentWorld', 'EARTH');
    this.registry.set('lives', 3);
    this.registry.set('health', 100);
    this.registry.set('score', 0);
    this.registry.set('attackBoost', 1);
    this.registry.set('defenseBoost', 1);

    // Start the game
    this.scene.start('GameScene');
    this.scene.launch('UIScene');
  }

  shutdown(): void {
    // Clean up input element when scene shuts down
    if (this.nameInput) {
      this.nameInput.remove();
      this.nameInput = null;
    }
  }
}
