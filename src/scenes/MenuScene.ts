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

    // Title
    const title = this.add.text(width / 2, 100, 'Krone des Gingers', {
      fontSize: '48px',
      color: '#FFD700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    });
    title.setOrigin(0.5);

    // Subtitle
    const subtitle = this.add.text(width / 2, 160, 'Ein episches Abenteuer', {
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    subtitle.setOrigin(0.5);

    // Name input label
    const nameLabel = this.add.text(width / 2, 250, 'Dein Name:', {
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    nameLabel.setOrigin(0.5);

    // Create HTML input for name
    this.createNameInput(width / 2, 290);

    // Start button
    const startButton = this.add.rectangle(width / 2, 400, 200, 60, 0x4CAF50);
    startButton.setInteractive({ useHandCursor: true });

    const startText = this.add.text(width / 2, 400, 'Spiel starten', {
      fontSize: '24px',
      color: '#ffffff',
    });
    startText.setOrigin(0.5);

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

    // Controls info
    const controlsText = this.add.text(width / 2, 480,
      'Steuerung:\n' +
      'Pfeiltasten / WASD - Bewegen\n' +
      'LEERTASTE - Springen (kurz tippen = kleiner Hopser, halten = hoher Sprung)\n' +
      'Wand berühren + LEERTASTE - Wandsprung ← NEU!\n' +
      'X - Angreifen  |  C - Ausweichen',
      {
        fontSize: '16px',
        color: '#ffffff',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
      }
    );
    controlsText.setOrigin(0.5);

    // Touch mode toggle button (y=545, below controls text)
    this.createTouchToggle(width / 2, 545);

    // Fullscreen button (bottom-right corner)
    this.createFullscreenButton(width, height);

    // Allow Enter key to start game
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.startGame();
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
    const btn = this.add.text(width - 16, height - 16, '⛶', {
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 1).setScrollFactor(0).setInteractive({ useHandCursor: true }).setAlpha(0.7);

    btn.on('pointerover', () => btn.setAlpha(1));
    btn.on('pointerout', () => btn.setAlpha(0.7));
    btn.on('pointerdown', () => {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
        btn.setText('⛶');
      } else {
        this.scale.startFullscreen();
        btn.setText('✕');
      }
    });
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

  private startGame(): void {
    // Get player name
    this.playerName = this.nameInput?.value.trim() || 'Held';

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
