/**
 * GameScene — Level 1: "Das große Abenteuer"
 *
 * Level design — 7 zones across 6000 px:
 *
 *   Zone 1 (x:    0– 700) Tutorial Meadow   — walk, jump, stomp mushrooms; coins lead the path
 *   Zone 2 (x:  700–1400) Staircase Hills    — rising platforms, introduce radish
 *   Zone 3 (x: 1400–2000) Chimney Canyon     — wall-jump chimneys, secret bonus area
 *   Zone 4 (x: 2000–2800) Underground Descent— descending cave, tight gaps, darker feel
 *   Zone 5 (x: 2800–3600) Sky Islands        — big gaps, high platforms, double-jump required
 *   Zone 6 (x: 3600–4600) Plant Fortress     — ranged plants, elevated platforms
 *   Zone 7 (x: 4600–5800) Final Gauntlet     — all enemy types, Rino mini-boss, flag at x=5700
 *
 * Physics reference (at scale 2×):
 *   Player body: 40×56 px world units.  sprite.y = body_bottom - 32.
 *   Standing on ground (tile y=550): sprite.y ≈ 510, body [486, 542]
 *   Standing on platform y_tile:     sprite.y = y_tile - 40
 *   Normal jump apex:  ~100 px above standing position
 *   Wall jump:         same apex height + horizontal kick of 220 px/s
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, EnemyFactory, PlantEnemy } from '../entities/Enemy';
import { GAME_CONFIG } from '../config/GameConfig';
// isTouchDevice used indirectly via VirtualControlsScene

export class GameScene extends Phaser.Scene {
  public player!: Player;
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

  // ── VFX: Zone banners ────────────────────────────────────────────────────────
  private announcedZones: Set<number> = new Set();
  private readonly ZONE_THRESHOLDS = [700, 1400, 2000, 2800, 3600, 4600];
  private readonly ZONE_NAMES = [
    '🌿 Zone 1: Wiese',
    '⛰️ Zone 2: Hügelland',
    '🧱 Zone 3: Schlucht',
    '🕳️ Zone 4: Höhle',
    '☁️ Zone 5: Himmelsinseln',
    '🌿 Zone 6: Pflanzenfestung',
    '💀 Zone 7: Finales Gauntlet',
  ];

  // ── VFX: Landing dust ────────────────────────────────────────────────────────
  private wasOnFloor: boolean = false;

  // ── VFX: Zone background overlays ───────────────────────────────────────────
  private zoneOverlays: Phaser.GameObjects.Rectangle[] = [];
  private currentOverlayZone: number = 0;

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
    this.announcedZones = new Set();
    this.wasOnFloor = true;
    this.currentOverlayZone = 0;
    this.zoneOverlays = [];

    // ── World & camera setup ─────────────────────────────────────────────────
    this.physics.world.setBounds(0, -300, 6000, 900);
    this.cameras.main.setBounds(0, -300, 6000, 900);

    // Scrolling background (parallax later in update)
    this.background = this.add.tileSprite(0, 0, 800, 600, 'bg-green');
    this.background.setOrigin(0, 0);
    this.background.setScrollFactor(0);

    // ── Zone background overlays (fixed, behind everything) ──────────────────
    this.createZoneOverlays();

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
    this.goalSprite = this.physics.add.staticSprite(5700, 478, 'end-idle');
    this.goalSprite.setScale(2);
    this.goalSprite.refreshBody();

    // Goal label
    this.add.text(5700, 440, '🏁 Ziel!', {
      fontSize: '18px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // ── Checkpoints ──────────────────────────────────────────────────────────
    this.registry.set('lastCheckpoint', { x: 100, y: 480 });
    this.checkpoints = this.physics.add.staticGroup();
    [1400, 2000, 2800, 3600, 4600].forEach(cx => {
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

    // Show Zone 1 banner immediately
    this.time.delayedCall(1000, () => {
      this.showZoneBanner(this.ZONE_NAMES[0]);
      this.announcedZones.add(0);
    });

    // Camera follows player with a comfortable deadzone
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(120, 80);

    // ── Mobile: init touch registry + launch virtual controls overlay ────────
    this.registry.set('touchInput', { left: false, right: false, jump: false, attack: false, dodge: false });
    if (!this.scene.isActive('VirtualControlsScene')) {
      this.scene.launch('VirtualControlsScene');
    }
  }

  // ── Zone background overlays ─────────────────────────────────────────────────

  private createZoneOverlays(): void {
    // Overlay configs: [color, alpha] for zones 1-7 (index 0-6)
    const overlayConfigs: [number, number][] = [
      [0x000000, 0.0],   // Zone 1: none
      [0x000000, 0.0],   // Zone 2: none
      [0x4a2800, 0.08],  // Zone 3: cave brown
      [0x000033, 0.10],  // Zone 4: dark blue cave
      [0x88ccff, 0.06],  // Zone 5: light sky blue
      [0x330000, 0.08],  // Zone 6: danger red
      [0x220000, 0.10],  // Zone 7: deep danger
    ];

    overlayConfigs.forEach(([color, alpha]) => {
      const rect = this.add.rectangle(400, 300, 800, 600, color, alpha);
      rect.setScrollFactor(0);
      rect.setDepth(1);
      rect.setAlpha(0); // Start hidden
      this.zoneOverlays.push(rect);
    });
  }

  private switchZoneOverlay(zoneIndex: number): void {
    if (zoneIndex === this.currentOverlayZone) return;

    const prevRect = this.zoneOverlays[this.currentOverlayZone];
    const nextRect = this.zoneOverlays[zoneIndex];

    // Fade out old overlay
    this.tweens.add({
      targets: prevRect,
      alpha: 0,
      duration: 800,
    });

    // Fade in new overlay (to its target alpha)
    const configs: number[] = [0, 0, 0.08, 0.10, 0.06, 0.08, 0.10];
    const targetAlpha = configs[zoneIndex] || 0;
    this.tweens.add({
      targets: nextRect,
      alpha: targetAlpha,
      duration: 800,
    });

    this.currentOverlayZone = zoneIndex;
  }

  // ── Platform construction ────────────────────────────────────────────────────

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Ground floor with gap at required chimney (zone 3)
    for (let x = 0; x < 6000; x += 16) {
      // Gap at required chimney zone 3 (x 1614–1726)
      if (x + 8 >= 1614 && x + 8 <= 1726) continue;
      const t = this.platforms.create(x + 8, 550, 'terrain', GameScene.TILE_GRASS) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }

    // Decorative dirt tiles below ground
    for (let x = 0; x < 6000; x += 16) {
      this.add.image(x + 8, 566, 'terrain', GameScene.TILE_DIRT);
      this.add.image(x + 8, 582, 'terrain', GameScene.TILE_DIRT);
    }

    // ── Zone 1 — Tutorial Meadow (0–700) ────────────────────────────────────
    // Gentle intro platforms with coins leading the way
    this.createPlatform(200, 490, 3);   // small hop
    this.createPlatform(380, 458, 4);   // medium rise
    this.createPlatform(560, 426, 3);   // another step up
    this.createPlatform(660, 500, 2);   // drop back down before zone 2

    // ── Zone 2 — Staircase Hills (700–1400) ─────────────────────────────────
    // Rising staircase with varied heights
    this.createPlatform(720,  472, 3);
    this.createPlatform(860,  440, 4);
    this.createPlatform(1000, 408, 3);
    this.createPlatform(1130, 370, 5);
    this.createPlatform(1270, 340, 4);
    // Side ledge with bonus
    this.createPlatform(940,  490, 2);   // low platform between stairs
    this.createPlatform(1180, 490, 2);   // another low one

    // ── Zone 3 — Chimney Canyon (1400–2000) ─────────────────────────────────
    // OPTIONAL chimney (shorter walls, player can skip via jump)
    this.createChimneyWall(1400, 268, 460);
    this.createChimneyWall(1496, 268, 460);
    this.createPlatform(1504, 228, 8);   // reward platform above optional chimney
    // Secret area — hidden platform above the lid (reachable via double-jump from top)
    this.createPlatform(1470, 170, 4);   // secret bonus platform

    // REQUIRED chimney (walls reach ground — must wall-jump)
    this.createPlatform(1530, 480, 5);   // approach platform
    this.createChimneyWall(1622, 260, 542);
    this.createChimneyWall(1718, 260, 542);
    this.createPlatform(1730, 220, 10);  // wide reward platform above
    this.createPlatform(1800, 380, 4);   // landing platform after chimney
    this.createPlatform(1880, 430, 3);   // step down to zone 4

    // ── Zone 4 — Underground Descent (2000–2800) ────────────────────────────
    // Platforms descend toward y=520, cave-like pattern, tight gaps
    this.createPlatform(2020, 400, 4);
    this.createPlatform(2160, 440, 3);
    this.createPlatform(2280, 470, 4);
    this.createPlatform(2380, 500, 3);   // nearly at ground level
    this.createPlatform(2480, 460, 4);   // back up slightly
    this.createPlatform(2580, 420, 3);
    this.createPlatform(2690, 460, 4);
    // Underground ceiling chunks (decorative pressure)
    this.createPlatform(2200, 280, 3);   // hanging platform (ceiling feel)
    this.createPlatform(2450, 300, 2);

    // ── Zone 5 — Sky Islands (2800–3600) ────────────────────────────────────
    // High floating platforms with BIG gaps — double jump required
    this.createPlatform(2820, 400, 3);   // entry platform
    this.createPlatform(2960, 320, 3);   // jump up
    this.createPlatform(3100, 290, 4);   // very high
    this.createPlatform(3260, 310, 3);   // slightly lower
    this.createPlatform(3390, 280, 4);   // highest point
    this.createPlatform(3500, 340, 3);   // start descent
    this.createPlatform(3590, 400, 4);   // exit platform
    // Small optional cloud platforms in between (extra challenge)
    this.createPlatform(3030, 370, 2);
    this.createPlatform(3180, 350, 2);

    // ── Zone 6 — Plant Fortress (3600–4600) ─────────────────────────────────
    // Elevated platforms, 3 plants guarding the path
    this.createPlatform(3680, 460, 5);
    this.createPlatform(3840, 420, 5);
    this.createPlatform(4000, 380, 6);
    this.createPlatform(4180, 340, 5);
    this.createPlatform(4350, 380, 4);
    this.createPlatform(4480, 420, 5);
    this.createPlatform(4560, 460, 4);
    // High sniper platforms for plants
    this.createPlatform(3780, 340, 3);
    this.createPlatform(4100, 300, 3);

    // ── Zone 7 — Final Gauntlet (4600–5800) ─────────────────────────────────
    // Dense enemy placement, fast pace, Rino mini-boss, end flag
    this.createPlatform(4680, 460, 4);
    this.createPlatform(4820, 420, 4);
    this.createPlatform(4960, 380, 5);
    this.createPlatform(5120, 430, 4);
    this.createPlatform(5260, 470, 4);
    this.createPlatform(5380, 420, 5);
    this.createPlatform(5520, 460, 4);
    this.createPlatform(5640, 490, 5);   // approach to flag
    // Elevated drama platforms
    this.createPlatform(5000, 310, 3);
    this.createPlatform(5200, 340, 3);
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
    // ─ Zone 1 — Tutorial (2 mushrooms) ───────────────────────────────────────
    const m1 = EnemyFactory.createMushroom(this, 310, 510);
    m1.setPatrolDistance(70);
    this.enemies.add(m1);

    const m2 = EnemyFactory.createMushroom(this, 570, 510);
    m2.setPatrolDistance(60);
    this.enemies.add(m2);

    // ─ Zone 2 — Staircase (3 mushrooms + 1 radish) ───────────────────────────
    const m3 = EnemyFactory.createMushroom(this, 760, 510);
    m3.setPatrolDistance(60);
    this.enemies.add(m3);

    const m4 = EnemyFactory.createMushroom(this, 980, 510);
    m4.setPatrolDistance(50);
    this.enemies.add(m4);

    const m5 = EnemyFactory.createMushroom(this, 1180, 510);
    m5.setPatrolDistance(40);
    this.enemies.add(m5);

    const r1 = EnemyFactory.createRadish(this, 1290, 300);
    r1.setPatrolDistance(30);
    this.enemies.add(r1);

    // ─ Zone 3 — Chimney (1 chicken + 1 mushroom) ─────────────────────────────
    const c1 = EnemyFactory.createChicken(this, 1560, 440);
    c1.setPatrolDistance(30);
    this.enemies.add(c1);

    const m6 = EnemyFactory.createMushroom(this, 1850, 510);
    m6.setPatrolDistance(40);
    this.enemies.add(m6);

    // ─ Zone 4 — Underground (3 mushrooms + 1 radish + 1 chicken) ─────────────
    const m7 = EnemyFactory.createMushroom(this, 2050, 510);
    m7.setPatrolDistance(50);
    this.enemies.add(m7);

    const m8 = EnemyFactory.createMushroom(this, 2200, 510);
    m8.setPatrolDistance(40);
    this.enemies.add(m8);

    const r2 = EnemyFactory.createRadish(this, 2430, 420);
    r2.setPatrolDistance(25);
    this.enemies.add(r2);

    const c2 = EnemyFactory.createChicken(this, 2600, 510);
    c2.setPatrolDistance(60);
    this.enemies.add(c2);

    const m9 = EnemyFactory.createMushroom(this, 2710, 510);
    m9.setPatrolDistance(50);
    this.enemies.add(m9);

    // ─ Zone 5 — Sky Islands (2 radish + 1 chicken) ───────────────────────────
    const r3 = EnemyFactory.createRadish(this, 2960, 280);
    r3.setPatrolDistance(20);
    this.enemies.add(r3);

    const c3 = EnemyFactory.createChicken(this, 3150, 250);
    c3.setPatrolDistance(25);
    this.enemies.add(c3);

    const r4 = EnemyFactory.createRadish(this, 3400, 240);
    r4.setPatrolDistance(30);
    this.enemies.add(r4);

    // ─ Zone 6 — Plant Fortress (3 plants + 2 mushrooms) ─────────────────────
    const plant1 = EnemyFactory.createPlant(this, 3800, 300);
    this.plantEnemies.push(plant1);
    this.enemies.add(plant1);

    const m10 = EnemyFactory.createMushroom(this, 3900, 510);
    m10.setPatrolDistance(50);
    this.enemies.add(m10);

    const plant2 = EnemyFactory.createPlant(this, 4130, 260);
    this.plantEnemies.push(plant2);
    this.enemies.add(plant2);

    const m11 = EnemyFactory.createMushroom(this, 4300, 510);
    m11.setPatrolDistance(40);
    this.enemies.add(m11);

    const plant3 = EnemyFactory.createPlant(this, 4520, 380);
    this.plantEnemies.push(plant3);
    this.enemies.add(plant3);

    // ─ Zone 7 — Final Gauntlet (2 chickens + 2 mushrooms + 1 radish + Rino) ──
    const c4 = EnemyFactory.createChicken(this, 4750, 510);
    c4.setPatrolDistance(60);
    this.enemies.add(c4);

    const m12 = EnemyFactory.createMushroom(this, 4900, 510);
    m12.setPatrolDistance(50);
    this.enemies.add(m12);

    const r5 = EnemyFactory.createRadish(this, 5060, 340);
    r5.setPatrolDistance(25);
    this.enemies.add(r5);

    const c5 = EnemyFactory.createChicken(this, 5250, 510);
    c5.setPatrolDistance(70);
    this.enemies.add(c5);

    const m13 = EnemyFactory.createMushroom(this, 5430, 510);
    m13.setPatrolDistance(45);
    this.enemies.add(m13);

    // 🦏 RINO MINI-BOSS before the flag
    const rino = EnemyFactory.createRino(this, 5580, 510);
    rino.setPatrolDistance(80);
    this.enemies.add(rino);

    // Add mini-boss label
    this.add.text(5580, 460, '⚠️ BOSS', {
      fontSize: '13px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Total: 2+4+2+5+3+5+6 = 27 enemies (within target)
  }

  // ── Collectible spawning ─────────────────────────────────────────────────────

  private spawnItems(): void {
    // ─ Fruit power-ups scattered through the level ───────────────────────────
    // Zone 1
    this.createItem(420, 430, 'cherry', 'health');
    // Zone 2
    this.createItem(1130, 328, 'apple', 'health');
    // Zone 3a secret
    this.createItem(1490, 140, 'melon', 'life');        // in secret room
    this.createItem(1590, 180, 'strawberry', 'health');
    // Zone 3b reward
    this.createItem(1750, 180, 'orange', 'attack');
    // Zone 4
    this.createItem(2520, 420, 'kiwi', 'defense');
    // Zone 5
    this.createItem(3100, 250, 'banana', 'attack');
    // Zone 6
    this.createItem(4000, 340, 'pineapple', 'health');
    // Zone 7
    this.createItem(5000, 270, 'cherry', 'health');
    this.createItem(5200, 300, 'apple', 'health');

    // ── Coins — 30 coins spread across all 7 zones ───────────────────────────
    const coinPositions: [number, number][] = [
      // Zone 1 (4 coins)
      [150, 490], [265, 462], [440, 430], [640, 510],
      // Zone 2 (5 coins)
      [760, 450], [880, 418], [1010, 386], [1145, 348], [1295, 318],
      // Zone 3 (4 coins)
      [1420, 490], [1508, 196], [1540, 196], [1758, 358],   // 2 above optional chimney lid
      // Zone 4 (5 coins)
      [2050, 490], [2180, 490], [2390, 490], [2520, 490], [2700, 510],
      // Zone 5 (5 coins)
      [2870, 380], [2990, 298], [3110, 268], [3290, 288], [3520, 318],
      // Zone 6 (4 coins)
      [3720, 490], [3900, 490], [4180, 510], [4500, 510],
      // Zone 7 (5 coins)
      [4720, 510], [4960, 510], [5100, 310], [5390, 490], [5600, 490],
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
    // Zone 3: chimney hints
    this.add.text(1428, 512, '↑ Wandsprung?', {
      fontSize: '12px', color: '#ffe066', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(1560, 460, '⬆ Wandsprung nötig!', {
      fontSize: '13px', color: '#ff6644', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 4: cave hint
    this.add.text(2050, 350, '🕳️ Tiefer... immer tiefer...', {
      fontSize: '12px', color: '#99ccff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 5: sky hint
    this.add.text(2870, 350, '☁️ Doppelsprung nutzen!', {
      fontSize: '13px', color: '#aaddff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 7: boss warning
    this.add.text(4650, 450, '💀 Letzte Zone! Achtung!', {
      fontSize: '14px', color: '#ff4444', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Secret room hint (faint)
    this.add.text(1510, 145, '✨ Geheimbereich!', {
      fontSize: '11px', color: '#ffff88', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.7);
  }

  // ── VFX: Zone transition banner ──────────────────────────────────────────────

  private showZoneBanner(name: string): void {
    const banner = this.add.text(-300, 280, name, {
      fontSize: '28px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 5,
      backgroundColor: '#00000088',
      padding: { x: 18, y: 10 },
    }).setScrollFactor(0).setOrigin(0, 0.5).setDepth(10);

    // Slide in from left, hold, slide out
    this.tweens.add({
      targets: banner,
      x: 80,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: banner,
            x: -500,
            duration: 350,
            ease: 'Power2.easeIn',
            onComplete: () => { banner.destroy(); },
          });
        });
      },
    });
  }

  // ── VFX: Landing dust ────────────────────────────────────────────────────────

  private spawnLandingDust(x: number, y: number): void {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const side = i < 2 ? -1 : 1;
      const dust = this.add.rectangle(
        x + side * (8 + Math.random() * 12),
        y,
        5, 5,
        0xddddcc,
        0.8,
      );
      this.tweens.add({
        targets:  dust,
        x:        dust.x + side * (20 + Math.random() * 25),
        y:        dust.y - 10 - Math.random() * 10,
        alpha:    0,
        scaleX:   0.2,
        scaleY:   0.2,
        duration: 350 + Math.random() * 150,
        ease:     'Power2',
        onComplete: () => { dust.destroy(); },
      });
    }
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

    // Stomp detection — separate overlap
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

    // Player ↔ checkpoints
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
          this.lastKilledPos = { x: e.x, y: e.y };
          e.takeDamage(damage);
        }
      });
    });

    // Enhanced enemyKilled with shake, particles, combo & score multiplier
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
        }).setScrollFactor(0).setOrigin(0.5).setDepth(10);
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

    // VFX: Plant warning indicator
    this.events.on('plantWarning', (px: number, py: number) => {
      const warn = this.add.text(px, py - 50, '❗', {
        fontSize: '22px',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8);
      this.tweens.add({
        targets:  warn,
        y:        py - 65,
        alpha:    0,
        duration: 400,
        onComplete: () => { warn.destroy(); },
      });
    });
  }

  // ── Death particles ──────────────────────────────────────────────────────────

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
    }).setOrigin(0.5).setDepth(9);

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
      this.livesLost++;

      this.registry.set('lives', lives - 1);
      this.events.emit('livesUpdated', lives - 1);

      // Respawn at last checkpoint
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

    // ── Save highscore to localStorage ───────────────────────────────────────
    const score = (this.registry.get('score') as number) || 0;
    const prevHighscore = parseInt(localStorage.getItem('highscore') || '0', 10);
    const newHighscore = Math.max(score, prevHighscore);
    localStorage.setItem('highscore', newHighscore.toString());

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

    this.add.text(400, 300, `Punkte: ${score}`, {
      fontSize: '22px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5);

    if (score > prevHighscore) {
      this.add.text(400, 330, '🏆 NEUER HIGHSCORE!', {
        fontSize: '18px',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 3,
      }).setScrollFactor(0).setOrigin(0.5);
    }

    // 3-star rating
    const collectedCoins = (this.registry.get('collectedCoins') as number) || 0;
    const totalCoins = this.totalCoins || 1;
    let stars = 1;
    if (collectedCoins >= totalCoins * 0.6) stars = 2;
    if (collectedCoins >= totalCoins && this.livesLost === 0) stars = 3;
    const starDisplay = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(400, 365, starDisplay, {
      fontSize: '48px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 425, `🪙 ${collectedCoins}/${totalCoins} Münzen gesammelt`, {
      fontSize: '16px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setScrollFactor(0).setOrigin(0.5);

    this.add.text(400, 460, 'Weiter zum Hauptmenü...', {
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

    // ── VFX: Zone banner & overlay triggers ──────────────────────────────────
    this.checkZoneTransitions();

    // ── VFX: Landing dust ────────────────────────────────────────────────────
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const isOnFloorNow = playerBody.onFloor();
    if (!this.wasOnFloor && isOnFloorNow) {
      this.spawnLandingDust(this.player.x, this.player.y + 28);
    }
    this.wasOnFloor = isOnFloorNow;

    // ── VFX: Wall-slide dust particles ──────────────────────────────────────
    const isWallSliding = !isOnFloorNow &&
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

  // ── VFX: Zone transition check ───────────────────────────────────────────────

  private checkZoneTransitions(): void {
    const px = this.player.x;

    // Check zone thresholds: [700, 1400, 2000, 2800, 3600, 4600]
    // Zones 1-7, zone index = 0-based
    for (let i = 0; i < this.ZONE_THRESHOLDS.length; i++) {
      const threshold = this.ZONE_THRESHOLDS[i];
      const zoneIndex = i + 1; // Zone 2–7 (index 1–6 in names array)

      if (px >= threshold && !this.announcedZones.has(zoneIndex)) {
        this.announcedZones.add(zoneIndex);
        this.showZoneBanner(this.ZONE_NAMES[zoneIndex]);
        this.switchZoneOverlay(zoneIndex);
      }
    }
  }
}
