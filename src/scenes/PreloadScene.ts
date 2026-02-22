import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // Show loading progress
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Lade...', {
      fontSize: '20px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5, 0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontSize: '18px',
      color: '#ffffff',
    });
    percentText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      percentText.setText(Math.round(value * 100) + '%');
      progressBar.clear();
      progressBar.fillStyle(0x00ff00, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Load all game assets
    this.loadPlayerAssets();
    this.loadEnemyAssets();
    this.loadTileAssets();
    this.loadItemAssets();
    this.loadBackgrounds();
  }

  private loadPlayerAssets(): void {
    // Player spritesheets - 32x32 frames
    this.load.spritesheet('player-idle', 'assets/player/Idle (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('player-run', 'assets/player/Run (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('player-jump', 'assets/player/Jump (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('player-fall', 'assets/player/Fall (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('player-double-jump', 'assets/player/Double Jump (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('player-hit', 'assets/player/Hit (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('player-wall-jump', 'assets/player/Wall Jump (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  private loadEnemyAssets(): void {
    // Mushroom enemy
    this.load.spritesheet('mushroom-idle', 'assets/enemies/Mushroom/Idle (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('mushroom-run', 'assets/enemies/Mushroom/Run (32x32).png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('mushroom-hit', 'assets/enemies/Mushroom/Hit.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Chicken enemy
    this.load.spritesheet('chicken-idle', 'assets/enemies/Chicken/Idle (32x34).png', {
      frameWidth: 32,
      frameHeight: 34,
    });
    this.load.spritesheet('chicken-run', 'assets/enemies/Chicken/Run (32x34).png', {
      frameWidth: 32,
      frameHeight: 34,
    });
    this.load.spritesheet('chicken-hit', 'assets/enemies/Chicken/Hit (32x34).png', {
      frameWidth: 32,
      frameHeight: 34,
    });

    // Rino enemy (will be used as "mole" placeholder)
    this.load.spritesheet('rino-idle', 'assets/enemies/Rino/Idle (52x34).png', {
      frameWidth: 52,
      frameHeight: 34,
    });
    this.load.spritesheet('rino-run', 'assets/enemies/Rino/Run (52x34).png', {
      frameWidth: 52,
      frameHeight: 34,
    });
    this.load.spritesheet('rino-hit', 'assets/enemies/Rino/Hit (52x34).png', {
      frameWidth: 52,
      frameHeight: 34,
    });

    // Plant enemy (stationary, shoots)
    this.load.spritesheet('plant-idle', 'assets/enemies/Plant/Idle (44x42).png', {
      frameWidth: 44,
      frameHeight: 42,
    });
    this.load.spritesheet('plant-attack', 'assets/enemies/Plant/Attack (44x42).png', {
      frameWidth: 44,
      frameHeight: 42,
    });
    this.load.spritesheet('plant-hit', 'assets/enemies/Plant/Hit (44x42).png', {
      frameWidth: 44,
      frameHeight: 42,
    });
    this.load.image('plant-bullet', 'assets/enemies/Plant/Bullet.png');

    // Radish enemy (patrols)
    this.load.spritesheet('radish-idle', 'assets/enemies/Radish/Idle 1 (30x38).png', {
      frameWidth: 30,
      frameHeight: 38,
    });
    this.load.spritesheet('radish-run', 'assets/enemies/Radish/Run (30x38).png', {
      frameWidth: 30,
      frameHeight: 38,
    });
    this.load.spritesheet('radish-hit', 'assets/enemies/Radish/Hit (30x38).png', {
      frameWidth: 30,
      frameHeight: 38,
    });
  }

  private loadTileAssets(): void {
    // Load terrain as spritesheet (352x176 = 22x11 tiles of 16x16)
    this.load.spritesheet('terrain', 'assets/tiles/Terrain (16x16).png', {
      frameWidth: 16,
      frameHeight: 16,
    });
  }

  private loadItemAssets(): void {
    // Fruit collectibles — all 32×32 frames, 17 frames each
    this.load.spritesheet('apple',      'assets/items/Apple.png',      { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('banana',     'assets/items/Bananas.png',    { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('cherry',     'assets/items/Cherries.png',   { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('kiwi',       'assets/items/Kiwi.png',       { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('melon',      'assets/items/Melon.png',      { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('orange',     'assets/items/Orange.png',     { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('pineapple',  'assets/items/Pineapple.png',  { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('strawberry', 'assets/items/Strawberry.png', { frameWidth: 32, frameHeight: 32 });

    // Level goal sprites
    // End (Idle) is a single 64×64 image — load as a plain image, not a spritesheet
    this.load.image('end-idle', 'assets/items/End (Idle).png');
    // End (Pressed) is an 8-frame 512×64 spritesheet
    this.load.spritesheet('end-pressed', 'assets/items/End (Pressed) (64x64).png', {
      frameWidth: 64,
      frameHeight: 64,
    });
  }

  private loadBackgrounds(): void {
    this.load.image('bg-blue', 'assets/backgrounds/Blue.png');
    this.load.image('bg-brown', 'assets/backgrounds/Brown.png');
    this.load.image('bg-gray', 'assets/backgrounds/Gray.png');
    this.load.image('bg-green', 'assets/backgrounds/Green.png');
    this.load.image('bg-pink', 'assets/backgrounds/Pink.png');
    this.load.image('bg-purple', 'assets/backgrounds/Purple.png');
    this.load.image('bg-yellow', 'assets/backgrounds/Yellow.png');
  }

  create(): void {
    this.createAnimations();
    if (this.registry.get('__testMode')) {
      this.scene.start('TestScene');
    } else {
      this.scene.start('MenuScene');
    }
  }

  private createAnimations(): void {
    // Player animations
    this.anims.create({
      key: 'player-idle-anim',
      frames: this.anims.generateFrameNumbers('player-idle', { start: 0, end: 10 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-run-anim',
      frames: this.anims.generateFrameNumbers('player-run', { start: 0, end: 11 }),
      frameRate: 20,
      repeat: -1,
    });

    this.anims.create({
      key: 'player-jump-anim',
      frames: this.anims.generateFrameNumbers('player-jump', { start: 0, end: 0 }),
      frameRate: 1,
      repeat: 0,
    });

    this.anims.create({
      key: 'player-fall-anim',
      frames: this.anims.generateFrameNumbers('player-fall', { start: 0, end: 0 }),
      frameRate: 1,
      repeat: 0,
    });

    this.anims.create({
      key: 'player-double-jump-anim',
      frames: this.anims.generateFrameNumbers('player-double-jump', { start: 0, end: 5 }),
      frameRate: 15,
      repeat: 0,
    });

    this.anims.create({
      key: 'player-hit-anim',
      frames: this.anims.generateFrameNumbers('player-hit', { start: 0, end: 6 }),
      frameRate: 10,
      repeat: 0,
    });

    // Wall-jump / wall-slide animation — loops while player is on the wall
    this.anims.create({
      key: 'player-wall-jump-anim',
      frames: this.anims.generateFrameNumbers('player-wall-jump', { start: 0, end: 4 }),
      frameRate: 10,
      repeat: -1,
    });

    // Mushroom animations
    this.anims.create({
      key: 'mushroom-idle-anim',
      frames: this.anims.generateFrameNumbers('mushroom-idle', { start: 0, end: 13 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: 'mushroom-run-anim',
      frames: this.anims.generateFrameNumbers('mushroom-run', { start: 0, end: 15 }),
      frameRate: 15,
      repeat: -1,
    });

    // Chicken animations
    this.anims.create({
      key: 'chicken-idle-anim',
      frames: this.anims.generateFrameNumbers('chicken-idle', { start: 0, end: 12 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: 'chicken-run-anim',
      frames: this.anims.generateFrameNumbers('chicken-run', { start: 0, end: 13 }),
      frameRate: 15,
      repeat: -1,
    });

    // Rino (mole placeholder) animations
    this.anims.create({
      key: 'rino-idle-anim',
      frames: this.anims.generateFrameNumbers('rino-idle', { start: 0, end: 10 }),
      frameRate: 10,
      repeat: -1,
    });

    this.anims.create({
      key: 'rino-run-anim',
      frames: this.anims.generateFrameNumbers('rino-run', { start: 0, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });

    // Plant animations
    this.anims.create({
      key: 'plant-idle-anim',
      frames: this.anims.generateFrameNumbers('plant-idle', { start: 0, end: 10 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'plant-attack-anim',
      frames: this.anims.generateFrameNumbers('plant-attack', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: 0,
    });

    // Radish animations
    this.anims.create({
      key: 'radish-idle-anim',
      frames: this.anims.generateFrameNumbers('radish-idle', { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'radish-run-anim',
      frames: this.anims.generateFrameNumbers('radish-run', { start: 0, end: 11 }),
      frameRate: 12,
      repeat: -1,
    });

    // Item animations
    this.anims.create({
      key: 'apple-anim',
      frames: this.anims.generateFrameNumbers('apple', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    this.anims.create({
      key: 'cherry-anim',
      frames: this.anims.generateFrameNumbers('cherry', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    this.anims.create({
      key: 'kiwi-anim',
      frames: this.anims.generateFrameNumbers('kiwi', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    this.anims.create({
      key: 'melon-anim',
      frames: this.anims.generateFrameNumbers('melon', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    // Additional fruit animations used by the level
    this.anims.create({
      key: 'strawberry-anim',
      frames: this.anims.generateFrameNumbers('strawberry', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    this.anims.create({
      key: 'orange-anim',
      frames: this.anims.generateFrameNumbers('orange', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    this.anims.create({
      key: 'pineapple-anim',
      frames: this.anims.generateFrameNumbers('pineapple', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    this.anims.create({
      key: 'banana-anim',
      frames: this.anims.generateFrameNumbers('banana', { start: 0, end: 16 }),
      frameRate: 15,
      repeat: -1,
    });

    // Level-end goal animation (plays when player touches the end flag)
    this.anims.create({
      key: 'end-pressed-anim',
      frames: this.anims.generateFrameNumbers('end-pressed', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: 0,
    });
  }
}
