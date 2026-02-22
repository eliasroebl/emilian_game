/**
 * GameScene — Level 1: "Das große Abenteuer"
 *
 * Level design — 5 zones across 4000 px:
 *
 *   Zone 1 (x:   0–700)  Tutorial Meadow  — walk, jump, stomp first mushrooms
 *   Zone 2 (x: 700–1300) Staircase Hills  — rising platforms, chained jumps
 *   Zone 3 (x:1300–1900) Chimney Canyon   — optional + required wall-jump chimneys
 *   Zone 4 (x:1900–2800) Plant Fortress   — ranged plants, elevated platforms
 *   Zone 5 (x:2800–3800) Final Rush       — all enemy types, end flag at x=3700
 *
 * Physics reference (at scale 2×):
 *   Player body: 40×56 px world units.  sprite.y = body_bottom - 32.
 *   Standing on ground (tile y=550): sprite.y ≈ 510, body [486, 542]
 *   Standing on platform y_tile:     sprite.y = y_tile - 40
 *   Normal jump apex:  ~100 px above standing position
 *   Wall jump:         same apex height + horizontal kick of 180 px/s
 *   Optional chimney wall bottom tile at y=460 → tile bottom at y=468 < player
 *   body top at y=486 when on ground → player walks freely beneath the walls.
 *   Required chimney walls reach y=542 → player MUST wall-jump to cross.
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, EnemyFactory, PlantEnemy } from '../entities/Enemy';
import { GAME_CONFIG } from '../config/GameConfig';
// isTouchDevice used indirectly via VirtualControlsScene

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private plantEnemies: PlantEnemy[] = [];
  private items!: Phaser.Physics.Arcade.Group;
  private goalSprite!: Phaser.Physics.Arcade.Sprite;
  private checkpoints!: Phaser.Physics.Arcade.StaticGroup;

  private background!: Phaser.GameObjects.TileSprite;
  private levelComplete: boolean = false;

  // Terrain tile frames from the 22×11 spritesheet (352×176 px, 16×16 each)
  private static readonly TILE_GRASS = 96;   // green top tile
  private static readonly TILE_DIRT  = 118;  // dark soil tile (used for walls)

  // ── Agent 2: Juice — combo & particles ──────────────────────────────────────
  private comboCount: number = 0;
  private comboTimer: Phaser.Time.TimerEvent | null = null;
  private lastKilledPos: { x: number; y: number } = { x: 0, y: 0 };

  // ── Agent 3: Coins ───────────────────────────────────────────────────────────
  private totalCoins: number = 0;

  // ── Agent 4: Stars & UI ──────────────────────────────────────────────────────
  private livesLost: number = 0;
  private wallSlideParticleTimer: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.levelComplete = false;
    this.plantEnemies  = [];
    this.comboCount    = 0;
    this.comboTimer    = null;
    this.lastKilledPos = { x: 0, y: 0 };
    this.livesLost     = 0;
    this.wallSlideParticleTimer = 0;

    // ── World & camera setup ─────────────────────────────────────────────────
    this.physics.world.setBounds(0, -300, 4000, 900);
    this.cameras.main.setBounds(0, -300, 4000, 900);

    // Scrolling background (parallax later in update)
    this.background = this.add.tileSprite(0, 0, 800, 600, 'bg-green');
    this.background.setOrigin(0, 0);
    this.background.setScrollFactor(0);

    // ── Level construction ───────────────────────────────────────────────────
    this.createPlatforms();

    // ── Player ───────────────────────────────────────────────────────────────
    const playerName = (this.registry.get('playerName') as string) || 'Held';
    console.log(`Willkommen, ${playerName}!`);
    this.player = new Player(this, 100, 480);

    // ── Groups ───────────────────────────────────────────────────────────────
    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.items   = this.physics.add.group();

    // ── Goal (end flag) ──────────────────────────────────────────────────────
    this.goalSprite = this.physics.add.staticSprite(3700, 478, 'end-idle');
    this.goalSprite.setScale(2);
    this.goalSprite.refreshBody();

    // ── Checkpoints (Agent 1) ────────────────────────────────────────────────
    this.registry.set('lastCheckpoint', { x: 100, y: 480 });
    this.checkpoints = this.physics.add.staticGroup();
    [1300, 1900, 2800].forEach(cx => {
      const cp = this.checkpoints.create(cx, 510, 'terrain', 0) as Phaser.Physics.Arcade.Sprite;
      cp.setAlpha(0);
      cp.refreshBody();
    });

    this.spawnEnemies();
    this.spawnItems();

    // Init coin registry after spawnItems sets totalCoins
    this.registry.set('totalCoins', this.totalCoins);
    this.registry.set('collectedCoins', 0);

    this.setupCollisions();
    this.setupEvents();
    this.addZoneHints();

    // Camera follows player with a comfortable deadzone
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(120, 80);

    // ── Mobile: init touch registry + launch virtual controls overlay ────────
    this.registry.set('touchInput', { left: false, right: false, jump: false, attack: false, dodge: false });
    if (!this.scene.isActive('VirtualControlsScene')) {
      this.scene.launch('VirtualControlsScene');
    }
  }

  // ── Platform construction ────────────────────────────────────────────────────

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    for (let x = 0; x < 4000; x += 16) {
      if (x + 8 >= 1614 && x + 8 <= 1726) continue;
      const t = this.platforms.create(x + 8, 550, 'terrain', GameScene.TILE_GRASS) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }

    for (let x = 0; x < 4000; x += 16) {
      this.add.image(x + 8, 566, 'terrain', GameScene.TILE_DIRT);
      this.add.image(x + 8, 582, 'terrain', GameScene.TILE_DIRT);
    }

    // ── Zone 1 — Tutorial Meadow ─────────────────────────────────────────────
    this.createPlatform(210, 488, 3);
    this.createPlatform(390, 456, 4);
    this.createPlatform(560, 424, 3);

    // ── Zone 2 — Staircase Hills ─────────────────────────────────────────────
    this.createPlatform(720,  472, 3);
    this.createPlatform(860,  440, 4);
    this.createPlatform(1010, 400, 5);
    this.createPlatform(1160, 360, 4);

    // ── Zone 3a — OPTIONAL Chimney ───────────────────────────────────────────
    this.createChimneyWall(1380, 268, 460);
    this.createChimneyWall(1476, 268, 460);
    this.createPlatform(1492, 228, 8);

    // ── Zone 3b — REQUIRED Chimney ───────────────────────────────────────────
    this.createPlatform(1510, 480, 5);
    this.createChimneyWall(1622, 260, 542);
    this.createChimneyWall(1718, 260, 542);
    this.createPlatform(1730, 220, 10);
    this.createPlatform(1790, 380, 4);

    // ── Zone 4 — Plant Fortress ──────────────────────────────────────────────
    this.createPlatform(1980, 440, 5);
    this.createPlatform(2180, 400, 5);
    this.createPlatform(2370, 360, 4);

    // ── Zone 5 — Final Rush ──────────────────────────────────────────────────
    this.createPlatform(2820, 472, 3);
    this.createPlatform(2950, 440, 3);
    this.createPlatform(3080, 400, 4);
    this.createPlatform(3240, 440, 3);
    this.createPlatform(3390, 400, 3);
    this.createPlatform(3540, 460, 4);
  }

  private createPlatform(x: number, y: number, widthTiles: number): void {
    for (let i = 0; i < widthTiles; i++) {
      const t = this.platforms.create(
        x + i * 16 + 8, y,
        'terrain', GameScene.TILE_GRASS,
      ) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }
  }

  private createChimneyWall(centerX: number, yTop: number, yBottom: number): void {
    for (let y = yTop; y <= yBottom; y += 16) {
      const t = this.platforms.create(
        centerX, y,
        'terrain', GameScene.TILE_DIRT,
      ) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }
  }

  // ── Enemy spawning ───────────────────────────────────────────────────────────

  private spawnEnemies(): void {
    // ─ Zone 1 ────────────────────────────────────────────────────────────────
    const m1 = EnemyFactory.createMushroom(this, 310, 510);
    m1.setPatrolDistance(70);
    this.enemies.add(m1);

    const m2 = EnemyFactory.createMushroom(this, 540, 510);
    m2.setPatrolDistance(60);
    this.enemies.add(m2);

    // ─ Zone 2 ────────────────────────────────────────────────────────────────
    const m3 = EnemyFactory.createMushroom(this, 780, 510);
    m3.setPatrolDistance(60);
    this.enemies.add(m3);

    const m4 = EnemyFactory.createMushroom(this, 990, 510);
    m4.setPatrolDistance(50);
    this.enemies.add(m4);

    const r1 = EnemyFactory.createRadish(this, 1042, 360);
    r1.setPatrolDistance(30);
    this.enemies.add(r1);

    // ─ Zone 4 ────────────────────────────────────────────────────────────────
    const plant1 = EnemyFactory.createPlant(this, 2012, 400);
    this.plantEnemies.push(plant1);
    this.enemies.add(plant1);

    const m5 = EnemyFactory.createMushroom(this, 2110, 510);
    m5.setPatrolDistance(50);
    this.enemies.add(m5);

    const plant2 = EnemyFactory.createPlant(this, 2212, 360);
    this.plantEnemies.push(plant2);
    this.enemies.add(plant2);

    const r2 = EnemyFactory.createRadish(this, 2402, 320);
    r2.setPatrolDistance(20);
    this.enemies.add(r2);

    // ─ Zone 5 ────────────────────────────────────────────────────────────────
    const m6 = EnemyFactory.createMushroom(this, 2850, 510);
    m6.setPatrolDistance(60);
    this.enemies.add(m6);

    const m7 = EnemyFactory.createMushroom(this, 2974, 400);
    m7.setPatrolDistance(20);
    this.enemies.add(m7);

    const c1 = EnemyFactory.createChicken(this, 3112, 360);
    c1.setPatrolDistance(25);
    this.enemies.add(c1);

    const c2 = EnemyFactory.createChicken(this, 3300, 510);
    c2.setPatrolDistance(80);
    this.enemies.add(c2);

    const plant3 = EnemyFactory.createPlant(this, 3572, 420);
    this.plantEnemies.push(plant3);
    this.enemies.add(plant3);
  }

  // ── Collectible spawning ─────────────────────────────────────────────────────

  private spawnItems(): void {
    // ─ Zone 1 ────────────────────────────────────────────────────────────────
    this.createItem(226, 450, 'cherry', 'health');

    // ─ Zone 2 ────────────────────────────────────────────────────────────────
    this.createItem(1192, 318, 'apple', 'health');

    // ─ Zone 3a ───────────────────────────────────────────────────────────────
    this.createItem(1428, 360, 'strawberry', 'health');
    this.createItem(1428, 186, 'melon', 'life');

    // ─ Zone 3b ───────────────────────────────────────────────────────────────
    this.createItem(1670, 360, 'orange', 'attack');

    // ─ Zone 4 ────────────────────────────────────────────────────────────────
    this.createItem(2426, 316, 'kiwi', 'defense');

    // ─ Zone 5 ────────────────────────────────────────────────────────────────
    this.createItem(3112, 356, 'banana', 'attack');
    this.createItem(3572, 416, 'pineapple', 'health');

    // ── Coins — Agent 3 (21 coins spread across all 5 zones) ─────────────────
    const coinPositions: [number, number][] = [
      // Zone 1
      [150, 490], [260, 460], [420, 430], [580, 400], [650, 490],
      // Zone 2
      [750, 450], [890, 420], [1040, 380], [1100, 490], [1190, 340],
      // Zone 3
      [1350, 490], [1430, 340], [1670, 350],
      // Zone 4
      [1950, 490], [2050, 420], [2190, 380], [2380, 340],
      // Zone 5
      [2870, 490], [3000, 420], [3120, 380], [3300, 490],
    ];
    coinPositions.forEach(([cx, cy]) => {
      this.createCoin(cx, cy);
    });
    this.totalCoins = coinPositions.length;
  }

  private createItem(x: number, y: number, sprite: string, type: string): void {
    const item = this.items.create(x, y, sprite) as Phaser.Physics.Arcade.Sprite;
    item.setScale(1.5);
    item.setData('type', type);

    const animKey = `${sprite}-anim`;
    if (this.anims.exists(animKey)) {
      item.play(animKey);
    }

    const body = item.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.tweens.add({
      targets:  item,
      y:        y - 8,
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ── Agent 3: Coin helper ─────────────────────────────────────────────────────

  private createCoin(x: number, y: number): void {
    const coin = this.items.create(x, y, 'cherry') as Phaser.Physics.Arcade.Sprite;
    coin.setScale(1.2);
    coin.setTint(0xFFD700);
    coin.setData('type', 'coin');

    const body = coin.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.tweens.add({
      targets:  coin,
      y:        y - 8,
      duration: 700,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ── Zone hints ───────────────────────────────────────────────────────────────

  private addZoneHints(): void {
    this.add.text(1428, 512, '↑ Wandsprung?', {
      fontSize: '12px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(1560, 460, '⬆ Wandsprung nötig!', {
      fontSize: '13px',
      color: '#ff6644',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(3700, 440, '🏁 Ziel!', {
      fontSize: '18px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
  }

  // ── Collision & overlap setup ────────────────────────────────────────────────

  private setupCollisions(): void {
    // Player ↔ platforms
    this.physics.add.collider(this.player, this.platforms);

    // Enemies ↔ platforms
    this.physics.add.collider(this.enemies, this.platforms);

    // Player ↔ enemies — damage overlap
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (playerObj, enemyObj) => {
        const p = playerObj as Player;
        const e = enemyObj as Enemy | PlantEnemy;
        if (!e.isEnemyDead() && !p.isPlayerInvincible()) {
          // Agent 2: screen shake on player damage
          this.cameras.main.shake(200, 0.008);
          p.takeDamage(e.getDamage());
        }
      },
    );

    // Agent 1: Stomp detection — separate overlap
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (playerObj, enemyObj) => {
        const p = playerObj as Player;
        const e = enemyObj as Enemy | PlantEnemy;
        if (e.isEnemyDead()) return;
        const pBody = p.body as Phaser.Physics.Arcade.Body;
        // Stomp = player falling down AND player bottom above enemy center
        if (pBody.velocity.y > 50 && (p.y + 28) < (e.y - 10)) {
          this.lastKilledPos = { x: e.x, y: e.y };
          e.takeDamage(999);
          p.setVelocityY(-350);
          this.showPickupText('STOMP! 💥', e.x, e.y - 40, '#FFD700');
        }
      },
    );

    // Player ↔ items
    this.physics.add.overlap(
      this.player,
      this.items,
      (playerObj, itemObj) => {
        this.handleItemCollection(playerObj as Player, itemObj as Phaser.Physics.Arcade.Sprite);
      },
    );

    // Player ↔ level goal
    this.physics.add.overlap(
      this.player,
      this.goalSprite,
      () => { this.handleLevelComplete(); },
    );

    // Player ↔ each plant's bullet group
    this.plantEnemies.forEach(plant => {
      this.physics.add.overlap(
        this.player,
        plant.getBullets(),
        (playerObj, bulletObj) => {
          const p = playerObj as Player;
          const bullet = bulletObj as Phaser.Physics.Arcade.Image;
          if (!p.isPlayerInvincible()) {
            this.cameras.main.shake(200, 0.008);
            p.takeDamage(10);
            bullet.destroy();
          }
        },
      );
    });

    // Agent 1: Player ↔ checkpoints
    this.physics.add.overlap(
      this.player,
      this.checkpoints,
      (_playerObj, cpObj) => {
        const cp = cpObj as Phaser.Physics.Arcade.Sprite;
        const last = (this.registry.get('lastCheckpoint') as { x: number; y: number }) || { x: 100, y: 480 };
        if (last.x !== cp.x) {
          this.registry.set('lastCheckpoint', { x: cp.x, y: 480 });
          this.showPickupText('✅ Checkpoint!', cp.x, 460, '#44ff44');
          cp.destroy();
        }
      },
    );
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  private setupEvents(): void {
    // Player's attack hitbox hits enemies
    this.events.on('playerAttack', (hitbox: Phaser.GameObjects.Rectangle, damage: number) => {
      const bounds = hitbox.getBounds();
      this.enemies.getChildren().forEach(enemy => {
        const e = enemy as Enemy | PlantEnemy;
        if (!e.isEnemyDead() && Phaser.Geom.Rectangle.Overlaps(bounds, e.getBounds())) {
          // Track position for death particles (Agent 2)
          this.lastKilledPos = { x: e.x, y: e.y };
          e.takeDamage(damage);
        }
      });
    });

    // Agent 2: Enhanced enemyKilled with shake, particles, combo & score multiplier
    this.events.on('enemyKilled', (points: number) => {
      // Screen shake
      this.cameras.main.shake(100, 0.004);

      // Death particles
      this.spawnDeathParticles(this.lastKilledPos.x, this.lastKilledPos.y, 0xFFAA00);

      // Combo system
      this.comboCount++;
      if (this.comboTimer) this.comboTimer.remove();
      this.comboTimer = this.time.delayedCall(2500, () => {
        this.comboCount = 0;
      });

      // Score with multiplier
      const multiplier = Math.min(this.comboCount, 5);
      const earned = points * multiplier;
      const current = (this.registry.get('score') as number) || 0;
      this.registry.set('score', current + earned);
      this.events.emit('scoreUpdated', current + earned);

      // Combo display at 3+
      if (this.comboCount >= 3) {
        const comboText = this.add.text(400, 200, `COMBO x${this.comboCount}! 🔥`, {
          fontSize: '36px',
          color: '#ff6600',
          stroke: '#000000',
          strokeThickness: 5,
        }).setScrollFactor(0).setOrigin(0.5);
        this.tweens.add({
          targets:  comboText,
          y:        150,
          alpha:    0,
          duration: 1500,
          onComplete: () => { comboText.destroy(); },
        });
      }
    });

    this.events.on('playerDied', () => { this.handlePlayerDeath(); });
  }

  // ── Agent 2: Death particles ─────────────────────────────────────────────────

  private spawnDeathParticles(x: number, y: number, color: number): void {
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 60 + Math.random() * 80;
      const rect = this.add.rectangle(x, y, 6, 6, color);
      this.tweens.add({
        targets:  rect,
        x:        x + Math.cos(angle) * speed,
        y:        y + Math.sin(angle) * speed,
        alpha:    0,
        scaleX:   0,
        scaleY:   0,
        duration: 400 + Math.random() * 200,
        ease:     'Power2',
        onComplete: () => { rect.destroy(); },
      });
    }
  }

  // ── Item collection ──────────────────────────────────────────────────────────

  private handleItemCollection(player: Player, item: Phaser.Physics.Arcade.Sprite): void {
    const type = item.getData('type') as string;

    switch (type) {
      case 'health': {
        player.heal(GAME_CONFIG.ITEMS.HEALTH_POTION.healAmount);
        this.showPickupText('+50 HP! ❤️', item.x, item.y, '#66ff66');
        break;
      }
      case 'attack': {
        const cur = (this.registry.get('attackBoost') as number) || 1;
        this.registry.set('attackBoost', cur * GAME_CONFIG.ITEMS.ATTACK_BOOST.multiplier);
        this.showPickupText('Angriff ↑', item.x, item.y, '#ff9900');
        this.time.delayedCall(GAME_CONFIG.ITEMS.ATTACK_BOOST.duration, () => {
          this.registry.set('attackBoost', 1);
        });
        break;
      }
      case 'defense': {
        const cur = (this.registry.get('defenseBoost') as number) || 1;
        this.registry.set('defenseBoost', cur * GAME_CONFIG.ITEMS.DEFENSE_BOOST.multiplier);
        this.showPickupText('Abwehr ↑', item.x, item.y, '#66aaff');
        this.time.delayedCall(GAME_CONFIG.ITEMS.DEFENSE_BOOST.duration, () => {
          this.registry.set('defenseBoost', 1);
        });
        break;
      }
      case 'life': {
        const lives = (this.registry.get('lives') as number) || 3;
        this.registry.set('lives', lives + 1);
        this.showPickupText('+1 Leben! ⭐', item.x, item.y, '#FFD700');
        this.events.emit('livesUpdated', lives + 1);
        break;
      }
      // Agent 3: Coin collection
      case 'coin': {
        const collected = ((this.registry.get('collectedCoins') as number) || 0) + 1;
        this.registry.set('collectedCoins', collected);
        const scoreNow = (this.registry.get('score') as number) || 0;
        this.registry.set('score', scoreNow + 10);
        this.events.emit('scoreUpdated', scoreNow + 10);
        this.events.emit('coinCollected', collected, this.totalCoins);
        this.showPickupText('+10 🪙', item.x, item.y, '#FFD700');
        break;
      }
    }

    item.destroy();
  }

  private showPickupText(message: string, x: number, y: number, color: string = '#ffffff'): void {
    const text = this.add.text(x, y, message, {
      fontSize: '15px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets:  text,
      y:        y - 55,
      alpha:    0,
      duration: 1000,
      onComplete: () => { text.destroy(); },
    });
  }

  // ── Death / respawn ──────────────────────────────────────────────────────────

  private handlePlayerDeath(): void {
    const lives = (this.registry.get('lives') as number) || 3;

    if (lives > 1) {
      // Agent 4: track lives lost for star rating
      this.livesLost++;

      this.registry.set('lives', lives - 1);
      this.events.emit('livesUpdated', lives - 1);

      // Agent 1: Respawn at last checkpoint
      const cp = (this.registry.get('lastCheckpoint') as { x: number; y: number }) || { x: 100, y: 480 };
      this.player.setPosition(cp.x, cp.y);
      this.player.heal(GAME_CONFIG.PLAYER.MAX_HEALTH);
      this.player.setAlpha(0.4);

      this.time.delayedCall(1500, () => { this.player.setAlpha(1); });
    } else {
      this.handleGameOver();
    }
  }

  private handleGameOver(): void {
    const overlay = this.add.graphics().setScrollFactor(0);
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, 800, 600);

    this.add.text(400, 230, 'Kein Leben mehr...', {
      fontSize: '38px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 6,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 295, 'Gut gespielt, versuch es nochmal!', {
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5);

    const score = (this.registry.get('score') as number) || 0;
    this.add.text(400, 340, `Deine Punkte: ${score}`, {
      fontSize: '20px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setOrigin(0.5);

    this.time.delayedCall(3500, () => {
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    });
  }

  // ── Level complete ───────────────────────────────────────────────────────────

  private handleLevelComplete(): void {
    if (this.levelComplete) return;
    this.levelComplete = true;

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setVelocity(0, 0);
    playerBody.setAllowGravity(false);

    if (this.anims.exists('end-pressed-anim')) {
      this.goalSprite.setTexture('end-pressed');
      this.goalSprite.play('end-pressed-anim');
    }

    this.cameras.main.shake(600, 0.006);

    const overlay = this.add.graphics().setScrollFactor(0);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 800, 600);

    const playerName = (this.registry.get('playerName') as string) || 'Held';
    this.add.text(400, 190, '🎉 LEVEL GESCHAFFT! 🎉', {
      fontSize: '34px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 5,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 250, `Super gemacht, ${playerName}!`, {
      fontSize: '26px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0).setOrigin(0.5);

    const score = (this.registry.get('score') as number) || 0;
    this.add.text(400, 300, `Punkte: ${score}`, {
      fontSize: '22px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5);

    // Agent 4: 3-star rating
    const collectedCoins = (this.registry.get('collectedCoins') as number) || 0;
    const totalCoins = this.totalCoins || 1;
    let stars = 1;
    if (collectedCoins >= totalCoins * 0.6) stars = 2;
    if (collectedCoins >= totalCoins && this.livesLost === 0) stars = 3;
    const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(400, 350, starDisplay, {
      fontSize: '48px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 415, `🪙 ${collectedCoins}/${totalCoins} Münzen gesammelt`, {
      fontSize: '16px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 450, 'Weiter zum Hauptmenü...', {
      fontSize: '16px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setOrigin(0.5);

    this.time.delayedCall(4500, () => {
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    });
  }

  // ── Update loop ──────────────────────────────────────────────────────────────

  update(): void {
    this.background.tilePositionX = this.cameras.main.scrollX * 0.25;

    if (this.levelComplete) return;

    this.player.update();

    this.enemies.getChildren().forEach(enemy => {
      const e = enemy as Enemy | PlantEnemy;
      if (e instanceof PlantEnemy) {
        e.update(this.player.x, this.player.y);
      } else {
        e.update();
      }
    });

    // Agent 4: Wall-slide dust particles (visual feedback)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const isWallSliding = !playerBody.onFloor() &&
      (playerBody.blocked.left || playerBody.blocked.right) &&
      playerBody.velocity.y > 0;

    if (isWallSliding && this.time.now - this.wallSlideParticleTimer > 120) {
      this.wallSlideParticleTimer = this.time.now;
      const px = this.player.x + (playerBody.blocked.left ? -12 : 12);
      const py = this.player.y;
      for (let i = 0; i < 3; i++) {
        const dust = this.add.rectangle(
          px + (Math.random() - 0.5) * 8,
          py + (Math.random() - 0.5) * 16,
          4, 4, 0xffffff, 0.7,
        );
        this.tweens.add({
          targets:  dust,
          y:        dust.y + 20 + Math.random() * 10,
          alpha:    0,
          duration: 300,
          onComplete: () => { dust.destroy(); },
        });
      }
    }
  }
}
