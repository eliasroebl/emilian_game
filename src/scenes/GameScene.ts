import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, EnemyFactory, PlantEnemy } from '../entities/Enemy';
import { GAME_CONFIG } from '../config/GameConfig';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private plantEnemies: PlantEnemy[] = [];
  private items!: Phaser.Physics.Arcade.Group;
  private itemTweens: Map<Phaser.Physics.Arcade.Sprite, Phaser.Tweens.Tween> = new Map();
  private boostTimers: Phaser.Time.TimerEvent[] = [];

  private background!: Phaser.GameObjects.TileSprite;
  private isTransitioning: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.isTransitioning = false;
    this.itemTweens.clear();
    this.boostTimers = [];

    const worldW = GAME_CONFIG.WORLD_WIDTH;
    const worldH = GAME_CONFIG.WORLD_HEIGHT;

    // Set world bounds for the level (wider than camera)
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // Setup background
    this.background = this.add.tileSprite(0, 0, 800, 600, 'bg-green');
    this.background.setOrigin(0, 0);
    this.background.setScrollFactor(0);

    // Set camera bounds
    this.cameras.main.setBounds(0, 0, worldW, worldH);

    // Pause key (ESC)
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.pause();
      this.scene.launch('PauseScene');
    });

    // Cleanup on shutdown
    this.events.on('shutdown', this.handleShutdown, this);

    // Create platforms
    this.createPlatforms();

    // Create player (spawn above ground level)
    const playerName = this.registry.get('playerName') || 'Held';
    console.log(`Willkommen, ${playerName}!`);
    this.player = new Player(this, 100, 480);

    // Create enemies group
    this.enemies = this.physics.add.group({
      runChildUpdate: true,
    });

    // Create items group
    this.items = this.physics.add.group();

    // Spawn enemies
    this.spawnEnemies();

    // Spawn items
    this.spawnItems();

    // Setup collisions
    this.setupCollisions();

    // Setup event listeners
    this.setupEvents();

    // Camera follows player
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setDeadzone(100, 100);
  }

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    const grassFrame = 96; // Top grass tile

    // Ground - full level width
    for (let x = 0; x < GAME_CONFIG.WORLD_WIDTH; x += 16) {
      const tile = this.platforms.create(x + 8, 550, 'terrain', grassFrame) as Phaser.Physics.Arcade.Sprite;
      tile.refreshBody();
    }

    // Add dirt below ground for visual depth
    for (let x = 0; x < GAME_CONFIG.WORLD_WIDTH; x += 16) {
      this.add.image(x + 8, 566, 'terrain', 118);
      this.add.image(x + 8, 582, 'terrain', 118);
    }

    // === LEVEL DESIGN ===
    // Section 1: Tutorial area (easy platforms, mushrooms)
    this.createPlatform(180, 480, 4);   // Low platform
    this.createPlatform(320, 420, 5);   // Medium platform
    this.createPlatform(500, 360, 4);   // Higher platform

    // Section 2: First challenge (radishes on platforms)
    this.createPlatform(700, 480, 6);   // Ground level platform
    this.createPlatform(850, 400, 5);   // Jump up
    this.createPlatform(1020, 330, 4);  // Higher

    // Section 3: Plant turret area
    this.createPlatform(1200, 480, 5);  // Recovery platform
    this.createPlatform(1350, 400, 6);  // Plant platform (wide for dodging)
    this.createPlatform(1550, 330, 5);  // Higher platform with item

    // Section 4: Gauntlet (multiple enemies)
    this.createPlatform(1750, 450, 4);
    this.createPlatform(1900, 380, 5);
    this.createPlatform(2050, 300, 6);  // High platform with plant
    this.createPlatform(2250, 380, 5);  // Final stretch

    // Add some decorative elements (non-collision)
    this.addDecorations();
  }

  private createPlatform(x: number, y: number, width: number): void {
    const grassFrame = 96;

    for (let i = 0; i < width; i++) {
      const tile = this.platforms.create(x + i * 16 + 8, y, 'terrain', grassFrame) as Phaser.Physics.Arcade.Sprite;
      tile.refreshBody();
    }
  }

  private addDecorations(): void {
    // Add some visual variety with decorative tiles (no collision)
    // These are just background elements
    const decorPositions = [150, 450, 900, 1400, 1800, 2200];
    decorPositions.forEach(x => {
      // Small grass tufts or rocks could go here
      // Using terrain tiles as decoration
      this.add.image(x, 540, 'terrain', 97).setAlpha(0.5);
    });
  }

  private spawnEnemies(): void {
    // === SECTION 1: Tutorial (Mushrooms only) ===
    // Ground mushrooms - easy to avoid
    const mushroom1 = EnemyFactory.createMushroom(this, 300, 480);
    mushroom1.setPatrolDistance(80);
    this.enemies.add(mushroom1);

    const mushroom2 = EnemyFactory.createMushroom(this, 550, 480);
    mushroom2.setPatrolDistance(100);
    this.enemies.add(mushroom2);

    // === SECTION 2: Radishes (faster, more aggressive) ===
    // Radish on platform
    const radish1 = EnemyFactory.createRadish(this, 880, 360);
    radish1.setPatrolDistance(60);
    this.enemies.add(radish1);

    // Ground radish
    const radish2 = EnemyFactory.createRadish(this, 950, 480);
    radish2.setPatrolDistance(100);
    this.enemies.add(radish2);

    // === SECTION 3: Plants (stationary, shoot projectiles) ===
    // Plant on elevated platform - player must dodge bullets
    const plant1 = EnemyFactory.createPlant(this, 1400, 360);
    this.plantEnemies.push(plant1);
    this.enemies.add(plant1);

    // Mushroom below to pressure player
    const mushroom3 = EnemyFactory.createMushroom(this, 1250, 480);
    this.enemies.add(mushroom3);

    // === SECTION 4: Gauntlet (mix of all enemies) ===
    // Ground enemies
    const radish3 = EnemyFactory.createRadish(this, 1800, 480);
    radish3.setPatrolDistance(80);
    this.enemies.add(radish3);

    const mushroom4 = EnemyFactory.createMushroom(this, 2000, 480);
    this.enemies.add(mushroom4);

    // Platform radish
    const radish4 = EnemyFactory.createRadish(this, 1930, 340);
    radish4.setPatrolDistance(50);
    this.enemies.add(radish4);

    // Final plant - guarding the end
    const plant2 = EnemyFactory.createPlant(this, 2100, 260);
    this.plantEnemies.push(plant2);
    this.enemies.add(plant2);

    // Last defender
    const radish5 = EnemyFactory.createRadish(this, 2300, 340);
    radish5.setPatrolDistance(60);
    this.enemies.add(radish5);
  }

  private spawnItems(): void {
    // Section 1: Easy pickups
    this.createItem(230, 440, 'apple', 'health');      // On first platform
    this.createItem(370, 380, 'cherry', 'attack');     // Attack boost early

    // Section 2: Rewards for platforming
    this.createItem(1050, 290, 'apple', 'health');     // After climbing
    this.createItem(880, 360, 'kiwi', 'defense');      // Defense for plant section

    // Section 3: Mid-level recovery
    this.createItem(1250, 440, 'apple', 'health');     // Before plant
    this.createItem(1580, 290, 'cherry', 'attack');    // Attack boost for gauntlet

    // Section 4: Final stretch rewards
    this.createItem(1930, 340, 'apple', 'health');     // Mid gauntlet
    this.createItem(2100, 260, 'kiwi', 'defense');     // Near final plant
    this.createItem(2350, 340, 'melon', 'life');       // Extra life reward at end
  }

  private createItem(x: number, y: number, sprite: string, type: string): void {
    const item = this.items.create(x, y, sprite) as Phaser.Physics.Arcade.Sprite;
    item.setScale(1.5);
    item.setData('type', type);

    // Play item animation
    const animKey = `${sprite}-anim`;
    if (this.anims.exists(animKey)) {
      item.play(animKey);
    }

    // Disable gravity for items
    const body = item.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    // Floating animation (tracked so we can stop it on collection)
    const tween = this.tweens.add({
      targets: item,
      y: y - 10,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.itemTweens.set(item, tween);
  }

  private setupCollisions(): void {
    // Player vs platforms
    this.physics.add.collider(this.player, this.platforms);

    // Enemies vs platforms
    this.physics.add.collider(this.enemies, this.platforms);

    // Player vs enemies
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.handlePlayerEnemyCollision,
      undefined,
      this
    );

    // Player vs items
    this.physics.add.overlap(
      this.player,
      this.items,
      this.handleItemCollection,
      undefined,
      this
    );

    // Player vs plant bullets
    this.plantEnemies.forEach(plant => {
      this.physics.add.overlap(
        this.player,
        plant.getBullets(),
        this.handleBulletHit,
        undefined,
        this
      );
    });
  }

  private setupEvents(): void {
    // Handle player attack hitting enemies
    this.events.on('playerAttack', (hitbox: Phaser.GameObjects.Rectangle, damage: number) => {
      this.enemies.getChildren().forEach((enemy) => {
        const e = enemy as Enemy | PlantEnemy;
        if (!e.isEnemyDead()) {
          const bounds = hitbox.getBounds();
          const enemyBounds = e.getBounds();

          if (Phaser.Geom.Rectangle.Overlaps(bounds, enemyBounds)) {
            e.takeDamage(damage);
          }
        }
      });
    });

    // Handle enemy killed
    this.events.on('enemyKilled', (points: number) => {
      const currentScore = this.registry.get('score') || 0;
      this.registry.set('score', currentScore + points);
      this.events.emit('scoreUpdated', currentScore + points);
    });

    // Handle player death
    this.events.on('playerDied', () => {
      this.handlePlayerDeath();
    });
  }

  private handlePlayerEnemyCollision: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (playerObj, enemyObj) => {
    if (this.isTransitioning) return;

    const player = playerObj as Player;
    const enemy = enemyObj as Enemy | PlantEnemy;

    if (!enemy.isEnemyDead() && !player.isPlayerInvincible()) {
      player.takeDamage(enemy.getDamage());
    }
  };

  private handleBulletHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (playerObj, bulletObj) => {
    if (this.isTransitioning) return;

    const player = playerObj as Player;
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;

    if (!player.isPlayerInvincible()) {
      player.takeDamage(10); // Bullet damage
      bullet.destroy();
    }
  };

  private handleItemCollection: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (playerObj, itemObj) => {
    if (this.isTransitioning) return;

    const player = playerObj as Player;
    const item = itemObj as Phaser.Physics.Arcade.Sprite;
    const type = item.getData('type');

    switch (type) {
      case 'health':
        player.heal(GAME_CONFIG.ITEMS.HEALTH_POTION.healAmount);
        this.showItemPickupText('+50 HP!', item.x, item.y);
        break;

      case 'attack': {
        const currentAttack = this.registry.get('attackBoost') || 1;
        this.registry.set('attackBoost', currentAttack * GAME_CONFIG.ITEMS.ATTACK_BOOST.multiplier);
        this.showItemPickupText('Angriff +25%!', item.x, item.y);
        const timer = this.time.delayedCall(GAME_CONFIG.ITEMS.ATTACK_BOOST.duration, () => {
          this.registry.set('attackBoost', 1);
        });
        this.boostTimers.push(timer);
        break;
      }

      case 'defense': {
        const currentDefense = this.registry.get('defenseBoost') || 1;
        // multiplier < 1 means damage reduction (e.g. 0.75 = take 75% damage = 25% reduction)
        this.registry.set('defenseBoost', currentDefense * GAME_CONFIG.ITEMS.DEFENSE_BOOST.multiplier);
        this.showItemPickupText('Verteidigung +25%!', item.x, item.y);
        const timer = this.time.delayedCall(GAME_CONFIG.ITEMS.DEFENSE_BOOST.duration, () => {
          this.registry.set('defenseBoost', 1);
        });
        this.boostTimers.push(timer);
        break;
      }

      case 'life': {
        const currentLives = this.registry.get('lives') || 3;
        const newLives = Math.min(currentLives + 1, 9);
        this.registry.set('lives', newLives);
        this.showItemPickupText('+1 Leben!', item.x, item.y);
        this.events.emit('livesUpdated', newLives);
        break;
      }
    }

    // Stop the floating tween before destroying
    const tween = this.itemTweens.get(item);
    if (tween) {
      tween.stop();
      this.itemTweens.delete(item);
    }

    item.destroy();
  };

  private showItemPickupText(message: string, x: number, y: number): void {
    const text = this.add.text(x, y, message, {
      fontSize: '16px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    });
    text.setOrigin(0.5);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
    });
  }

  private handlePlayerDeath(): void {
    const lives = this.registry.get('lives') || 3;

    // Clear active boost timers and reset boosts
    this.boostTimers.forEach(timer => timer.remove(false));
    this.boostTimers = [];
    this.registry.set('attackBoost', 1);
    this.registry.set('defenseBoost', 1);

    if (lives > 1) {
      // Respawn
      this.registry.set('lives', lives - 1);
      this.registry.set('health', GAME_CONFIG.PLAYER.MAX_HEALTH);
      this.events.emit('livesUpdated', lives - 1);

      // Reset player position and clear pending timers
      this.player.setPosition(100, 480);
      this.player.resetState();
      this.player.heal(GAME_CONFIG.PLAYER.MAX_HEALTH);

      // Brief invincibility
      this.player.setAlpha(0.5);
      this.time.delayedCall(1000, () => {
        this.player.setAlpha(1);
      });
    } else {
      // Game over
      this.gameOver();
    }
  }

  private gameOver(): void {
    this.isTransitioning = true;
    this.scene.pause();
    this.scene.launch('GameOverScene');
  }

  private handleShutdown(): void {
    // Kill all tweens to prevent memory leaks
    this.tweens.killAll();
    this.itemTweens.clear();

    // Clear boost timers
    this.boostTimers.forEach(timer => timer.remove(false));
    this.boostTimers = [];

    // Remove event listeners
    this.events.off('playerAttack');
    this.events.off('enemyKilled');
    this.events.off('playerDied');
    this.events.off('shutdown', this.handleShutdown, this);
  }

  update(): void {
    // Parallax background
    this.background.tilePositionX = this.cameras.main.scrollX * 0.3;

    // Update player
    this.player.update();

    // Update regular enemies
    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy | PlantEnemy;
      if (e instanceof PlantEnemy) {
        e.update(this.player.x, this.player.y);
      } else {
        e.update();
      }
    });
  }
}
