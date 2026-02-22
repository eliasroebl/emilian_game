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

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private plantEnemies: PlantEnemy[] = [];
  private items!: Phaser.Physics.Arcade.Group;
  private goalSprite!: Phaser.Physics.Arcade.Sprite;

  private background!: Phaser.GameObjects.TileSprite;
  private levelComplete: boolean = false;

  // Terrain tile frames from the 22×11 spritesheet (352×176 px, 16×16 each)
  private static readonly TILE_GRASS = 96;   // green top tile
  private static readonly TILE_DIRT  = 118;  // dark soil tile (used for walls)

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.levelComplete = false;
    this.plantEnemies  = [];

    // ── World & camera setup ─────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, 4000, 600);
    this.cameras.main.setBounds(0, 0, 4000, 600);

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
    // Place flag so its visual bottom rests on the ground (tile top ≈ 542).
    // end-idle is 64×64; at scale 2 → 128×128; center y = 542 − 64 = 478.
    this.goalSprite = this.physics.add.staticSprite(3700, 478, 'end-idle');
    this.goalSprite.setScale(2);
    this.goalSprite.refreshBody();

    this.spawnEnemies();
    this.spawnItems();
    this.setupCollisions();
    this.setupEvents();
    this.addZoneHints();

    // Camera follows player with a comfortable deadzone
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(120, 80);

    // ── Mobile: init touch registry + launch virtual controls overlay ────────
    this.registry.set('touchInput', { left: false, right: false, jump: false, attack: false, dodge: false });
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      this.scene.launch('VirtualControlsScene');
    }
  }

  // ── Platform construction ────────────────────────────────────────────────────

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Full-width grass ground (y = 550, spans entire 4000 px level).
    // Ground has a GAP at the required chimney (tile centres x: 1614–1726)
    // so the player absolutely cannot walk through.
    for (let x = 0; x < 4000; x += 16) {
      if (x + 8 >= 1614 && x + 8 <= 1726) continue; // gap under required chimney
      const t = this.platforms.create(x + 8, 550, 'terrain', GameScene.TILE_GRASS) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }

    // Decorative dirt rows below ground (no physics, just visual depth)
    for (let x = 0; x < 4000; x += 16) {
      this.add.image(x + 8, 566, 'terrain', GameScene.TILE_DIRT);
      this.add.image(x + 8, 582, 'terrain', GameScene.TILE_DIRT);
    }

    // ── Zone 1 — Tutorial Meadow (x: 0–700) ─────────────────────────────────
    //    Three gentle platforms teach the basic jump — low → mid → high.
    //    Enemy encounters only on the ground to keep pressure low.
    this.createPlatform(210, 488, 3);   // low hop  (gap 210 from start)
    this.createPlatform(390, 456, 4);   // mid hop  (gap 132 from P1 right edge)
    this.createPlatform(560, 424, 3);   // high hop (gap 106 from P2 right edge)

    // ── Zone 2 — Staircase Hills (x: 700–1300) ───────────────────────────────
    //    Rising staircase of four platforms; gaps 70–112 px (all normal jump).
    //    Radish guards step 3; apple reward sits at the very top.
    //    Gap Z1→Z2: 112 px (P3 right edge 608 → P4 left edge 720).
    this.createPlatform(720,  472, 3);  // step 1  (gap 112 from Zone 1 top)
    this.createPlatform(860,  440, 4);  // step 2  (gap  92)
    this.createPlatform(1010, 400, 5);  // step 3  (gap  86)  ← radish
    this.createPlatform(1160, 360, 4);  // step 4 / top  (gap 70) ← apple reward

    // ── Zone 3a — OPTIONAL Chimney (x: ~1350–1500) ───────────────────────────
    //    Walls stop above ground (yBottom=460, tile bottom=468 < player body
    //    top 486) — player CAN walk under.  Strawberry lures them in; melon
    //    waits on the reward platform above as a life-upgrade.
    this.createChimneyWall(1380, 268, 460);  // left wall  (bottom tile bottom=468)
    this.createChimneyWall(1476, 268, 460);  // right wall (inner gap = 80 px)
    this.createPlatform(1350, 228, 10);      // reward platform (160 px wide)

    // ── Zone 3b — REQUIRED Chimney (x: ~1600–1730) ───────────────────────────
    //    Walls reach y=542 (ground level) — player MUST wall-jump to pass.
    //    Wide safe platform before gives a reading spot for the hint text.
    //    Ground gap: tile centres 1614–1726 are skipped above.
    this.createPlatform(1510, 480, 5);       // safe landing/hint-reading spot
    this.createChimneyWall(1622, 260, 542);  // left wall  — reaches ground
    this.createChimneyWall(1718, 260, 542);  // right wall — reaches ground (gap=80)
    this.createPlatform(1594, 220, 10);      // exit platform (160 px wide)
    this.createPlatform(1790, 380, 4);       // descent step after chimney

    // ── Zone 4 — Plant Fortress (x: 1900–2800) ───────────────────────────────
    //    Two plant enemies on elevated platforms; mushroom patrols ground below;
    //    radish on the highest platform.  Teaches timing around ranged attacks.
    this.createPlatform(1980, 440, 5);       // plant 1 platform
    this.createPlatform(2180, 400, 5);       // plant 2 platform
    this.createPlatform(2370, 360, 4);       // high platform — radish + kiwi

    // ── Zone 5 — Final Rush (x: 2800–3800) ──────────────────────────────────
    //    All enemy types; up-down-up rhythm keeps momentum high; end flag x=3700.
    this.createPlatform(2820, 472, 3);       // step 1  (narrow, ground-adjacent)
    this.createPlatform(2950, 440, 3);       // step 2  (up 32, gap 82) ← mushroom
    this.createPlatform(3080, 400, 4);       // step 3  (up 40, gap 82) ← chicken
    this.createPlatform(3240, 440, 3);       // step 4  (down 40, gap 96)
    this.createPlatform(3390, 400, 3);       // step 5  (up 40, gap 102)
    this.createPlatform(3540, 460, 4);       // step 6  (down 60, gap 102) ← plant
  }

  /**
   * Creates a horizontal platform of `widthTiles` tiles at (x, y).
   * x is the LEFT edge of the first tile; tiles are 16 px wide.
   */
  private createPlatform(x: number, y: number, widthTiles: number): void {
    for (let i = 0; i < widthTiles; i++) {
      const t = this.platforms.create(
        x + i * 16 + 8, y,
        'terrain', GameScene.TILE_GRASS,
      ) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }
  }

  /**
   * Creates a single-tile-wide vertical wall from yTop to yBottom (inclusive),
   * spaced every 16 px.  Uses the dirt tile so it looks distinct from platforms.
   * centerX is the world center x of the column.
   */
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
    // Total enemies: 14  |  Plants: 3
    // Difficulty curve: Z1=easy, Z2=easy-med, Z3=none, Z4=med-hard, Z5=hard

    // ─ Zone 1 — Tutorial Meadow: 2 slow mushrooms ────────────────────────────
    //   Both on the ground, well spaced; first at x~310 after a short walk.
    const m1 = EnemyFactory.createMushroom(this, 310, 510);
    m1.setPatrolDistance(70);
    this.enemies.add(m1);

    const m2 = EnemyFactory.createMushroom(this, 540, 510);
    m2.setPatrolDistance(60);
    this.enemies.add(m2);

    // ─ Zone 2 — Staircase Hills: 2 mushrooms + 1 radish ─────────────────────
    //   Ground mushrooms flank the staircase; radish guards step 3.
    //   Platform y=400, 5 tiles: enemy spawn y = 400-40 = 360.
    const m3 = EnemyFactory.createMushroom(this, 780, 510);
    m3.setPatrolDistance(60);
    this.enemies.add(m3);

    const m4 = EnemyFactory.createMushroom(this, 990, 510);
    m4.setPatrolDistance(50);
    this.enemies.add(m4);

    const r1 = EnemyFactory.createRadish(this, 1042, 360);
    r1.setPatrolDistance(30);   // stays on 5-tile (80 px) platform
    this.enemies.add(r1);

    // ─ Zone 3 — Chimney Canyon: no enemies (the walls are the challenge) ─────

    // ─ Zone 4 — Plant Fortress: 2 plants + 1 mushroom + 1 radish ─────────────
    //   plant1 on platform y=440: spawn y = 440-40 = 400
    const plant1 = EnemyFactory.createPlant(this, 2012, 400);
    this.plantEnemies.push(plant1);
    this.enemies.add(plant1);

    //   Mushroom on the ground between the two plant platforms.
    const m5 = EnemyFactory.createMushroom(this, 2110, 510);
    m5.setPatrolDistance(50);
    this.enemies.add(m5);

    //   plant2 on platform y=400: spawn y = 400-40 = 360
    const plant2 = EnemyFactory.createPlant(this, 2212, 360);
    this.plantEnemies.push(plant2);
    this.enemies.add(plant2);

    //   Radish on highest platform y=360: spawn y = 360-40 = 320.  Patrol 20
    //   keeps it safely on the 4-tile (64 px) platform.
    const r2 = EnemyFactory.createRadish(this, 2402, 320);
    r2.setPatrolDistance(20);
    this.enemies.add(r2);

    // ─ Zone 5 — Final Rush: 2 mushrooms + 2 chickens + 1 plant ───────────────
    //   Mushroom on the ground at zone entry.
    const m6 = EnemyFactory.createMushroom(this, 2850, 510);
    m6.setPatrolDistance(60);
    this.enemies.add(m6);

    //   Mushroom on step 2 (platform y=440): spawn y = 440-40 = 400.
    //   Centre tile x=2974, patrol 20 keeps it on the 3-tile platform.
    const m7 = EnemyFactory.createMushroom(this, 2974, 400);
    m7.setPatrolDistance(20);
    this.enemies.add(m7);

    //   Chicken on step 3 (platform y=400): spawn y = 400-40 = 360.
    //   Centre of 4-tile platform; patrol 25 fits on 64 px surface.
    const c1 = EnemyFactory.createChicken(this, 3112, 360);
    c1.setPatrolDistance(25);
    this.enemies.add(c1);

    //   Fast chicken patrols the ground in the final stretch.
    const c2 = EnemyFactory.createChicken(this, 3300, 510);
    c2.setPatrolDistance(80);
    this.enemies.add(c2);

    //   Plant on step 6 (platform y=460): spawn y = 460-40 = 420.
    //   Placed to shoot toward the approaching player.
    const plant3 = EnemyFactory.createPlant(this, 3572, 420);
    this.plantEnemies.push(plant3);
    this.enemies.add(plant3);
  }

  // ── Collectible spawning ─────────────────────────────────────────────────────

  private spawnItems(): void {
    // ─ Zone 1 — reward for the first hop ─────────────────────────────────────
    //   Cherry sits above platform P1 (x=210, y=488) — easy first collectible.
    this.createItem(226, 450, 'cherry', 'health');

    // ─ Zone 2 — reward at the top of the staircase ───────────────────────────
    //   Apple waits at the far end of step 4 (y=360), away from the radish.
    this.createItem(1192, 318, 'apple', 'health');

    // ─ Zone 3a — optional chimney collectibles ───────────────────────────────
    //   Strawberry floats mid-gap to lure the player in.
    this.createItem(1428, 360, 'strawberry', 'health');
    //   Melon sits on the reward platform above — the grand prize for wall-jumping.
    this.createItem(1428, 186, 'melon', 'life');

    // ─ Zone 3b — encouragement inside the required chimney ───────────────────
    //   Orange floats mid-gap as a carrot while the player climbs the walls.
    this.createItem(1670, 360, 'orange', 'attack');

    // ─ Zone 4 — defence boost on the highest platform ────────────────────────
    //   Kiwi sits at the far end of the high platform (x=2370, y=360),
    //   away from the radish — reward for navigating past ranged fire.
    this.createItem(2426, 316, 'kiwi', 'defense');

    // ─ Zone 5 — rewards for skilled play ─────────────────────────────────────
    //   Banana hovers above the chicken platform (step 3, y=400) — risky grab.
    this.createItem(3112, 356, 'banana', 'attack');
    //   Pineapple on the last platform (step 6) before the end flag.
    this.createItem(3572, 416, 'pineapple', 'health');
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

    // Gentle floating animation
    this.tweens.add({
      targets:  item,
      y:        y - 8,
      duration: 900,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });
  }

  // ── Zone hints ───────────────────────────────────────────────────────────────
  // Subtle text hints attached to key spots (scroll with the world).

  private addZoneHints(): void {
    // Optional chimney — curious teaser below the gap entrance
    this.add.text(1428, 512, '↑ Wandsprung?', {
      fontSize: '12px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Required chimney — clear warning on the safe platform before the walls
    this.add.text(1560, 460, '⬆ Wandsprung nötig!', {
      fontSize: '13px',
      color: '#ff6644',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Goal marker text above the end flag
    this.add.text(3700, 440, '🏁 Ziel!', {
      fontSize: '18px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
  }

  // ── Collision & overlap setup ────────────────────────────────────────────────

  private setupCollisions(): void {
    // Player ↔ platforms (solid floor/walls)
    this.physics.add.collider(this.player, this.platforms);

    // Enemies ↔ platforms (so they don't fall through the floor)
    this.physics.add.collider(this.enemies, this.platforms);

    // Player ↔ enemies — overlap (no push-back; we handle damage manually)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (playerObj, enemyObj) => {
        const p = playerObj as Player;
        const e = enemyObj as Enemy | PlantEnemy;
        if (!e.isEnemyDead() && !p.isPlayerInvincible()) {
          p.takeDamage(e.getDamage());
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
            p.takeDamage(10);
            bullet.destroy();
          }
        },
      );
    });
  }

  // ── Event listeners ──────────────────────────────────────────────────────────

  private setupEvents(): void {
    // Player's attack hitbox hits enemies
    this.events.on('playerAttack', (hitbox: Phaser.GameObjects.Rectangle, damage: number) => {
      const bounds = hitbox.getBounds();
      this.enemies.getChildren().forEach(enemy => {
        const e = enemy as Enemy | PlantEnemy;
        if (!e.isEnemyDead() && Phaser.Geom.Rectangle.Overlaps(bounds, e.getBounds())) {
          e.takeDamage(damage);
        }
      });
    });

    this.events.on('enemyKilled', (points: number) => {
      const current = (this.registry.get('score') as number) || 0;
      this.registry.set('score', current + points);
      this.events.emit('scoreUpdated', current + points);
    });

    this.events.on('playerDied', () => { this.handlePlayerDeath(); });
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
      this.registry.set('lives', lives - 1);
      this.events.emit('livesUpdated', lives - 1);

      // Respawn at the start with brief invincibility
      this.player.setPosition(100, 400);
      this.player.heal(GAME_CONFIG.PLAYER.MAX_HEALTH);
      this.player.setAlpha(0.4);

      this.time.delayedCall(1500, () => { this.player.setAlpha(1); });
    } else {
      this.handleGameOver();
    }
  }

  private handleGameOver(): void {
    // Overlay fixed to the camera (scrollFactor 0 = screen-space)
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

    // Automatically return to menu after 3.5 seconds
    this.time.delayedCall(3500, () => {
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    });
  }

  // ── Level complete ───────────────────────────────────────────────────────────

  private handleLevelComplete(): void {
    if (this.levelComplete) return;
    this.levelComplete = true;

    // Freeze the player in place
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setVelocity(0, 0);
    playerBody.setAllowGravity(false);

    // Animate the goal flag to its pressed state
    if (this.anims.exists('end-pressed-anim')) {
      this.goalSprite.setTexture('end-pressed');
      this.goalSprite.play('end-pressed-anim');
    }

    // Camera flourish
    this.cameras.main.shake(600, 0.006);

    // Screen overlay (screen-space so it covers regardless of scroll)
    const overlay = this.add.graphics().setScrollFactor(0);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 800, 600);

    const playerName = (this.registry.get('playerName') as string) || 'Held';
    this.add.text(400, 200, '🎉 LEVEL GESCHAFFT! 🎉', {
      fontSize: '34px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 5,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 260, `Super gemacht, ${playerName}!`, {
      fontSize: '26px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0).setOrigin(0.5);

    const score = (this.registry.get('score') as number) || 0;
    this.add.text(400, 310, `Punkte: ${score} ⭐`, {
      fontSize: '22px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 360, 'Weiter zum Hauptmenü...', {
      fontSize: '16px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setOrigin(0.5);

    // Return to menu after 4.5 seconds
    this.time.delayedCall(4500, () => {
      this.scene.stop('UIScene');
      this.scene.start('MenuScene');
    });
  }

  // ── Update loop ──────────────────────────────────────────────────────────────

  update(): void {
    // Slow parallax scroll on the tiled background
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
  }
}
