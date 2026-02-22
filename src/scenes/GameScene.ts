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
import { Enemy, EnemyFactory, PlantEnemy, RinoBoss } from '../entities/Enemy';
import { GAME_CONFIG } from '../config/GameConfig';
import { soundFX } from '../audio/SoundFX';
// isTouchDevice used indirectly via VirtualControlsScene

declare global {
  interface Window {
    gameState: {
      playerX: number;
      playerY: number;
      velocityX: number;
      velocityY: number;
      health: number;
      lives: number;
      score: number;
      collectedCoins: number;
      totalCoins: number;
      enemiesAlive: number;
      levelComplete: boolean;
      lastCheckpoint: { x: number; y: number };
      onFloor: boolean;
      isWallSliding: boolean;
    };
  }
}

export class GameScene extends Phaser.Scene {
  public player!: Player;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  public enemies!: Phaser.Physics.Arcade.Group;
  private plantEnemies: PlantEnemy[] = [];
  private items!: Phaser.Physics.Arcade.Group;
  public goalSprite!: Phaser.Physics.Arcade.Sprite;
  public checkpoints!: Phaser.Physics.Arcade.StaticGroup;

  private background!: Phaser.GameObjects.TileSprite;
  private levelComplete: boolean = false;

  // Terrain tile frames from the 22×11 spritesheet (352×176 px, 16×16 each)
  private static readonly TILE_GRASS   = 96;   // green top tile
  private static readonly TILE_DIRT    = 118;  // dark soil tile (used for walls/platforms)
  // Layered terrain tiles (from top to bottom)
  private static readonly TILE_EARTH_TOP  = 7;   // bright green grass top (r0,c7 — rgb 106,135,38)
  private static readonly TILE_EARTH_MID  = 29;  // brown earth middle     (r1,c7 — rgb 183,108,82)
  private static readonly TILE_EARTH_DEEP = 95;  // darker earth           (r4,c7 — rgb 185,106,65)
  private static readonly TILE_EARTH_ROCK = 117; // deep dark earth/rock   (r5,c7 — rgb 158,69,66)
  // private static readonly TILE_EARTH_BASE = 139; // darkest base rock — reserved for future use

  // ── Agent 2: Juice — combo & particles ──────────────────────────────────────
  private comboCount: number = 0;
  private comboTimer: Phaser.Time.TimerEvent | null = null;
  private lastKilledPos: { x: number; y: number } = { x: 0, y: 0 };

  // ── Agent 3: Coins ───────────────────────────────────────────────────────────
  public totalCoins: number = 0;

  // ── Agent 4: Stars & UI ──────────────────────────────────────────────────────
  private livesLost: number = 0;
  private wallSlideParticleTimer: number = 0;

  // ── VFX: Zone banners ────────────────────────────────────────────────────────
  private announcedZones: Set<number> = new Set();
  private readonly ZONE_THRESHOLDS = [700, 1400, 2000, 2800, 3600, 4600, 6000, 7200, 8400, 9200, 10200, 11200];
  private readonly ZONE_NAMES = [
    '🌿 Zone 1: Wiese',
    '⛰️ Zone 2: Hügelland',
    '🧱 Zone 3: Schlucht',
    '🕳️ Zone 4: Höhle',
    '☁️ Zone 5: Himmelsinseln',
    '🌿 Zone 6: Pflanzenfestung',
    '💀 Zone 7: Finales Gauntlet',
    '🎯 Zone 8: Flipper Allee',
    '⬇️ Zone 9: Vertikal-Tal',
    '❄️ Zone 10: Eispalast',
    '🌲 Zone 11: Finsterer Wald',
    '🌋 Zone 12: Vulkan-Vorfeld',
    '🏔️ Zone 13: Gipfelsturm',
  ];

  // ── Bounce platforms ─────────────────────────────────────────────────────────
  private bouncePlatforms!: Phaser.Physics.Arcade.StaticGroup;

  // ── VFX: Landing dust ────────────────────────────────────────────────────────
  private wasOnFloor: boolean = false;

  // ── VFX: Zone background overlays ───────────────────────────────────────────
  private zoneOverlays: Phaser.GameObjects.Rectangle[] = [];
  private currentOverlayZone: number = 0;
  private bossArenaShown: boolean = false;

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
    this.bossArenaShown = false;
    this.bouncePlatforms = this.physics.add.staticGroup();

    // ── World & camera setup ─────────────────────────────────────────────────
    this.physics.world.setBounds(0, -300, 12000, 1100); // extra height for Zone 9 vertical shaft
    this.cameras.main.setBounds(0, -300, 12000, 1100);

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
    this.goalSprite = this.physics.add.staticSprite(11800, 268, 'end-idle');
    this.goalSprite.setScale(2);
    this.goalSprite.refreshBody();

    // Goal label
    this.add.text(11800, 230, '🏔️ GIPFEL!', {
      fontSize: '18px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // ── Checkpoints ──────────────────────────────────────────────────────────
    this.registry.set('lastCheckpoint', { x: 100, y: 480 });
    this.checkpoints = this.physics.add.staticGroup();
    [1400, 2000, 2800, 3600, 4600, 6000, 7200, 8400, 9200, 10200, 11000].forEach(cx => {
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

    // ── window.gameState bridge (for automated testing) ───────────────────────
    window.gameState = {
      playerX: 0, playerY: 0, velocityX: 0, velocityY: 0,
      health: 100, lives: 3, score: 0, collectedCoins: 0, totalCoins: 0,
      enemiesAlive: 0, levelComplete: false,
      lastCheckpoint: { x: 100, y: 480 }, onFloor: false, isWallSliding: false,
    };
  }

  // ── Zone background overlays ─────────────────────────────────────────────────

  private createZoneOverlays(): void {
    // Overlay configs: [color, alpha] for zones 1-13 (index 0-12)
    const overlayConfigs: [number, number][] = [
      [0x000000, 0.0],   // Zone 1: none
      [0x000000, 0.0],   // Zone 2: none
      [0x4a2800, 0.08],  // Zone 3: cave brown
      [0x000033, 0.10],  // Zone 4: dark blue cave
      [0x88ccff, 0.06],  // Zone 5: light sky blue
      [0x330000, 0.08],  // Zone 6: danger red
      [0x220000, 0.10],  // Zone 7: deep danger
      [0x000000, 0.0],   // Zone 8: normal (bounce allee)
      [0x003366, 0.12],  // Zone 9: deep blue (vertical shaft)
      [0xaaddff, 0.08],  // Zone 10: ice blue
      [0x001100, 0.14],  // Zone 11: dark forest
      [0xff3300, 0.10],  // Zone 12: volcano
      [0xff6600, 0.08],  // Zone 13: summit glow
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
    const configs: number[] = [0, 0, 0.08, 0.10, 0.06, 0.08, 0.10, 0, 0.12, 0.08, 0.14, 0.10, 0.08];
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
    // Also gap for Zone 9 vertical shaft entrance (x 7210–7490)
    for (let x = 0; x < 12000; x += 16) {
      // Gap at required chimney zone 3 (x 1614–1726)
      if (x + 8 >= 1614 && x + 8 <= 1726) continue;
      // Gap for Zone 9 vertical shaft entrance
      if (x + 8 >= 7220 && x + 8 <= 7480) continue;
      const t = this.platforms.create(x + 8, 550, 'terrain', GameScene.TILE_GRASS) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }

    // ── Layered terrain below ground — gives the Earth level depth ──────────
    // y=550 = grass collision layer (already created above)
    // y=566 = earth top (bright green/brown transition)
    // y=582 = earth middle (brown dirt)
    // y=598 = deep earth (darker brown)
    // y=614 = rock base (darkest — implies bedrock below)
    for (let x = 0; x < 12000; x += 16) {
      // Skip the shaft gap for visual continuity
      if (x + 8 >= 7220 && x + 8 <= 7480) continue;
      this.add.image(x + 8, 566, 'terrain', GameScene.TILE_EARTH_TOP).setDepth(-1);
      this.add.image(x + 8, 582, 'terrain', GameScene.TILE_EARTH_MID).setDepth(-1);
      this.add.image(x + 8, 598, 'terrain', GameScene.TILE_EARTH_DEEP).setDepth(-1);
      this.add.image(x + 8, 614, 'terrain', GameScene.TILE_EARTH_ROCK).setDepth(-1);
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
    // ── BOSS ARENA (x=5480–5900) — clear open ground, no platforms inside ──
    // Approach ledge before arena
    this.createPlatform(5440, 480, 3);   // small drop-in ledge before arena
    // Elevated drama platforms (above arena — safe to keep, boss can't reach)
    this.createPlatform(5000, 310, 3);
    this.createPlatform(5200, 340, 3);
    this.createPlatform(5550, 360, 4);   // high platform above arena (collectible/escape)
    // Exit platform after arena
    this.createPlatform(5900, 480, 5);

    // Bridge between Zone 7 and Zone 8
    this.createPlatform(5960, 470, 4);

    // ── Zone 8 — Flipper Allee (6000–7200) — Bouncing Madness ───────────────
    // Regular platforms
    this.createPlatform(6050, 490, 3);
    this.createPlatform(6170, 460, 3);
    // Bounce launch pad — sends player high
    this.createBouncePlatform(6280, 490, 3);
    // High landing platform (reachable via bounce)
    this.createPlatform(6360, 340, 4);
    // Back down
    this.createPlatform(6490, 430, 3);
    // Regular then another bounce
    this.createPlatform(6600, 470, 2);
    this.createBouncePlatform(6660, 490, 2);
    // Ultra-high secret platform (optional, reachable from bounce)
    this.createPlatform(6720, 250, 3);
    // Low path continues
    this.createPlatform(6790, 490, 3);
    this.createPlatform(6890, 460, 3);
    // Final bounce zone leading into Zone 9
    this.createBouncePlatform(6980, 490, 3);
    // High platform above the bounce
    this.createPlatform(7060, 350, 4);
    this.createPlatform(7130, 480, 3);   // entry ledge to shaft

    // ── Zone 9 — Vertikal-Tal (7200–8400) — Vertical Shaft ──────────────────
    // Entry ledge before shaft
    this.createPlatform(7160, 480, 4);
    // Directional sign platform (text added in addZoneHints)
    this.createPlatform(7500, 490, 4);   // exit ledge on right side of shaft
    // Shaft zigzag platforms (descend from y=580 to y=780)
    this.createPlatform(7220, 590, 3);   // top left
    this.createPlatform(7350, 630, 3);   // right
    this.createPlatform(7230, 670, 3);   // left again
    this.createPlatform(7360, 710, 3);   // right
    this.createPlatform(7240, 750, 3);   // left
    this.createPlatform(7380, 780, 4);   // bottom — hidden chamber
    this.createPlatform(7290, 780, 3);   // wide bottom chamber (connected)
    // Exit path back up on right side of shaft
    this.createPlatform(7490, 740, 3);
    this.createPlatform(7500, 700, 3);
    this.createPlatform(7510, 660, 3);
    this.createPlatform(7500, 620, 3);
    this.createPlatform(7490, 580, 3);
    // Continue right from shaft exit
    this.createPlatform(7600, 480, 4);
    this.createPlatform(7720, 450, 4);
    this.createPlatform(7840, 420, 3);
    this.createPlatform(7950, 460, 4);
    this.createPlatform(8070, 490, 3);
    this.createPlatform(8180, 430, 4);
    this.createPlatform(8290, 470, 3);

    // ── Zone 10 — Eispalast (8400–9200) — Ice Spires ────────────────────────
    // Ground-level chickens path
    this.createPlatform(8440, 490, 4);
    this.createPlatform(8560, 490, 3);
    this.createPlatform(8680, 490, 3);
    // Ice spires — tall narrow platforms at extreme heights
    this.createPlatform(8450, 220, 2);   // Spire 1 (very high)
    this.createPlatform(8580, 250, 2);   // Spire 2
    this.createPlatform(8710, 210, 2);   // Spire 3 (highest)
    this.createPlatform(8840, 240, 2);   // Spire 4
    this.createPlatform(8960, 260, 2);   // Spire 5
    this.createPlatform(9080, 220, 2);   // Spire 6
    // Mid-height stepping stones
    this.createPlatform(8510, 360, 2);
    this.createPlatform(8640, 340, 2);
    this.createPlatform(8770, 360, 2);
    this.createPlatform(8900, 350, 2);
    // Crystal cave chamber — wide central platform
    this.createPlatform(8750, 490, 8);   // Crystal chamber floor
    this.createPlatform(8800, 430, 4);   // Chamber raised area
    // Exit platforms
    this.createPlatform(9100, 470, 4);
    this.createPlatform(9170, 490, 3);

    // ── Zone 11 — Finsterer Wald (9200–10200) — Dark Forest ─────────────────
    // Regular path
    this.createPlatform(9250, 490, 4);
    this.createPlatform(9380, 470, 3);
    // Low ceiling section (tight corridor — ceiling at y=380, ground at y=550)
    this.createPlatform(9460, 380, 8);   // CEILING — creates tight corridor
    this.createPlatform(9480, 490, 6);   // Floor of corridor
    // After corridor — elevation changes
    this.createPlatform(9660, 420, 4);
    this.createPlatform(9780, 390, 3);
    this.createPlatform(9880, 450, 3);
    // Second corridor trap
    this.createPlatform(9960, 380, 6);   // CEILING 2
    this.createPlatform(9970, 490, 5);   // Floor 2
    // Final forest platforms
    this.createPlatform(10080, 460, 4);
    this.createPlatform(10160, 430, 3);
    this.createPlatform(10100, 310, 3);  // High platform (secret area hint)

    // ── Zone 12 — Vulkan-Vorfeld (10200–11200) — Volcano Approach ───────────
    // Progressively narrower platforms (1-2 tile wide)
    this.createPlatform(10260, 490, 2);
    this.createPlatform(10330, 460, 2);
    this.createPlatform(10400, 430, 2);
    this.createPlatform(10470, 460, 2);
    this.createPlatform(10540, 490, 1);   // 1-tile!
    this.createPlatform(10600, 460, 1);   // 1-tile!
    this.createPlatform(10640, 430, 2);
    // Wide arena before boss (give player room)
    this.createPlatform(10660, 490, 20);  // BOSS ARENA — wide fighting platform
    // Elevated arena platforms for dodging
    this.createPlatform(10700, 400, 4);
    this.createPlatform(10820, 400, 4);
    // Post-boss platforms
    this.createPlatform(10990, 490, 3);
    this.createPlatform(11060, 470, 3);
    this.createPlatform(11150, 490, 4);

    // ── Zone 13 — Gipfelsturm (11200–12000) — Summit ────────────────────────
    // Alternating high/low platforms (forces constant movement)
    this.createPlatform(11260, 490, 3);   // low
    this.createPlatform(11340, 390, 3);   // high
    this.createPlatform(11420, 480, 2);   // low
    this.createPlatform(11490, 380, 3);   // high
    this.createPlatform(11560, 470, 2);   // low
    // Epic ascending staircase to summit flag
    this.createPlatform(11620, 460, 2);   // step 1
    this.createPlatform(11660, 430, 2);   // step 2
    this.createPlatform(11700, 400, 2);   // step 3
    this.createPlatform(11740, 370, 2);   // step 4
    this.createPlatform(11760, 340, 2);   // step 5
    this.createPlatform(11770, 310, 2);   // step 6
    this.createPlatform(11780, 285, 4);   // SUMMIT — flag platform (wide enough to land safely)
  }

  private createBouncePlatform(x: number, y: number, widthTiles: number): void {
    for (let i = 0; i < widthTiles; i++) {
      const t = this.bouncePlatforms.create(
        x + i * 16 + 8, y,
        'terrain', GameScene.TILE_GRASS,
      ) as Phaser.Physics.Arcade.Sprite;
      t.setTint(0xFFAA00); // Yellow/orange tint — visual hint for bounce
      t.refreshBody();
    }
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
    const rino = new RinoBoss(this, 5700, 510); // center of open boss arena
    this.enemies.add(rino);

    // ─ Zone 8 — Flipper Allee (4 chickens) ───────────────────────────────────
    const c6 = EnemyFactory.createChicken(this, 6120, 510);
    c6.setPatrolDistance(60);
    this.enemies.add(c6);

    const c7 = EnemyFactory.createChicken(this, 6450, 510);
    c7.setPatrolDistance(50);
    this.enemies.add(c7);

    const c8 = EnemyFactory.createChicken(this, 6850, 510);
    c8.setPatrolDistance(55);
    this.enemies.add(c8);

    const c9 = EnemyFactory.createChicken(this, 7100, 510);
    c9.setPatrolDistance(40);
    this.enemies.add(c9);

    // ─ Zone 9 — Vertikal-Tal (2 radishes on shaft platforms + 1 plant at bottom) ──
    const r6 = EnemyFactory.createRadish(this, 7265, 550);
    r6.setPatrolDistance(25);
    this.enemies.add(r6);

    const r7 = EnemyFactory.createRadish(this, 7375, 590);
    r7.setPatrolDistance(20);
    this.enemies.add(r7);

    const plant4 = EnemyFactory.createPlant(this, 7340, 740);
    this.plantEnemies.push(plant4);
    this.enemies.add(plant4);

    // ─ Zone 10 — Eispalast (2 plants on spires + 2 chickens at ground) ────────
    const plant5 = EnemyFactory.createPlant(this, 8522, 180);
    this.plantEnemies.push(plant5);
    this.enemies.add(plant5);

    const plant6 = EnemyFactory.createPlant(this, 8762, 170);
    this.plantEnemies.push(plant6);
    this.enemies.add(plant6);

    const c10 = EnemyFactory.createChicken(this, 8590, 510);
    c10.setPatrolDistance(55);
    this.enemies.add(c10);

    const c11 = EnemyFactory.createChicken(this, 8810, 510);
    c11.setPatrolDistance(55);
    this.enemies.add(c11);

    // ─ Zone 11 — Finsterer Wald (3 mushrooms + 2 radishes + 2 chickens + 1 plant) ─
    const m14 = EnemyFactory.createMushroom(this, 9290, 510);
    m14.setPatrolDistance(55);
    this.enemies.add(m14);

    const c12 = EnemyFactory.createChicken(this, 9420, 510);
    c12.setPatrolDistance(50);
    this.enemies.add(c12);

    // Corridor trap enemies
    const m15 = EnemyFactory.createMushroom(this, 9520, 510);
    m15.setPatrolDistance(30);
    this.enemies.add(m15);

    const r8 = EnemyFactory.createRadish(this, 9570, 510);
    r8.setPatrolDistance(25);
    this.enemies.add(r8);

    const c13 = EnemyFactory.createChicken(this, 9710, 510);
    c13.setPatrolDistance(45);
    this.enemies.add(c13);

    const r9 = EnemyFactory.createRadish(this, 9830, 410);
    r9.setPatrolDistance(25);
    this.enemies.add(r9);

    // Second corridor enemies
    const m16 = EnemyFactory.createMushroom(this, 10000, 510);
    m16.setPatrolDistance(30);
    this.enemies.add(m16);

    const plant7 = EnemyFactory.createPlant(this, 10138, 270);
    this.plantEnemies.push(plant7);
    this.enemies.add(plant7);

    // ─ Zone 12 — Vulkan-Vorfeld (2 chickens + 2 radishes + 1 plant + RinoBoss II) ─
    const c14 = EnemyFactory.createChicken(this, 10310, 510);
    c14.setPatrolDistance(40);
    this.enemies.add(c14);

    const r10 = EnemyFactory.createRadish(this, 10430, 440);
    r10.setPatrolDistance(20);
    this.enemies.add(r10);

    const c15 = EnemyFactory.createChicken(this, 10570, 510);
    c15.setPatrolDistance(35);
    this.enemies.add(c15);

    const r11 = EnemyFactory.createRadish(this, 10660, 460);
    r11.setPatrolDistance(20);
    this.enemies.add(r11);

    const plant8 = EnemyFactory.createPlant(this, 10780, 360);
    this.plantEnemies.push(plant8);
    this.enemies.add(plant8);

    // 🦏🦏 RINO BOSS II — stronger, 400HP — at x=10840 in the arena
    const rino2 = new RinoBoss(this, 10800, 450, 400); // center of Zone 12 boss arena (platform y=490 → spawn y=450)
    rino2.setPatrolDistance(100);
    this.enemies.add(rino2);
    this.add.text(10840, 400, '⚠️ BOSS II', {
      fontSize: '13px',
      color: '#ff4444',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // ─ Zone 13 — Gipfelsturm (2 chickens + 1 radish) ─────────────────────────
    const c16 = EnemyFactory.createChicken(this, 11300, 510);
    c16.setPatrolDistance(40);
    this.enemies.add(c16);

    const r12 = EnemyFactory.createRadish(this, 11420, 350);
    r12.setPatrolDistance(20);
    this.enemies.add(r12);

    const c17 = EnemyFactory.createChicken(this, 11530, 510);
    c17.setPatrolDistance(35);
    this.enemies.add(c17);

    // Grand total: 27 (zones 1-7) + 4+3+4+8+6+3 = 28 new = 55 total enemies
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
      // Zone 8 — Flipper Allee (4 coins — on high bounce-accessible platforms)
      [6360, 305], [6720, 220], [7065, 320], [7180, 450],
      // Zone 9 — Vertikal-Tal (3 coins in shaft + 1 at bottom)
      [7235, 600], [7365, 650], [7250, 720], [7325, 760],
      // Zone 10 — Eispalast (4 coins on spire platforms)
      [8458, 195], [8650, 225], [8718, 195], [8968, 240],
      // Zone 11 — Finsterer Wald (4 coins)
      [9280, 450], [9630, 460], [9790, 360], [10090, 430],
      // Zone 12 — Vulkan-Vorfeld (3 coins before boss arena)
      [10320, 460], [10470, 420], [10650, 460],
      // Zone 13 — Gipfelsturm (2 coins on summit approach)
      [11350, 460], [11760, 350],
    ];
    coinPositions.forEach(([cx, cy]) => {
      this.createCoin(cx, cy);
    });
    this.totalCoins = coinPositions.length;

    // ── Zone 9 bonus: Star multiplier item at shaft bottom ───────────────────
    this.createItem(7340, 745, 'banana', 'star');

    // ── Zone 10: Defense boost in crystal cave chamber ───────────────────────
    this.createItem(8830, 400, 'kiwi', 'defense');

    // ── Zone 12: Star boost before Rino2 arena ───────────────────────────────
    this.createItem(10610, 400, 'orange', 'star');

    // ── Zone 12: Health pickup in arena (give player a fighting chance) ──────
    this.createItem(10720, 360, 'cherry', 'health');
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

    // Zone 8: bounce platform hint
    this.add.text(6285, 460, '🟡 Springend!', {
      fontSize: '12px', color: '#FFD700', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 9: vertical shaft hint
    this.add.text(7200, 470, '⬇ Tiefer!', {
      fontSize: '14px', color: '#aaddff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 9: bottom star hint
    this.add.text(7330, 755, '⭐ Bonus!', {
      fontSize: '11px', color: '#FFD700', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.8);

    // Zone 10: ice spire hint
    this.add.text(8600, 340, '❄️ Doppelsprung!', {
      fontSize: '12px', color: '#aaddff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 11: forest warning
    this.add.text(9250, 430, '🌲 Vorsicht — dichter Wald!', {
      fontSize: '12px', color: '#88ff88', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 12: boss warning
    this.add.text(10620, 450, '🌋 Vulkan-Boss voraus!', {
      fontSize: '14px', color: '#ff6600', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Zone 13: summit approach
    this.add.text(11600, 440, '🏔️ Gipfel — fast da!', {
      fontSize: '14px', color: '#FFD700', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
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

    // Player ↔ bounce platforms — launch player upward on land
    this.physics.add.collider(this.player, this.bouncePlatforms, () => {
      const pb = this.player.body as Phaser.Physics.Arcade.Body;
      if (pb.velocity.y >= 0) { // only on downward contact
        this.player.setVelocityY(-700);
        this.showPickupText('🎯 BOING!', this.player.x, this.player.y - 20, '#FFD700');
      }
    });

    // Enemies ↔ platforms
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.enemies, this.bouncePlatforms);

    // Player ↔ enemies — unified overlap: stomp takes priority over damage
    this.physics.add.overlap(
      this.player,
      this.enemies,
      (playerObj, enemyObj) => {
        const p = playerObj as Player;
        const e = enemyObj as Enemy | PlantEnemy | RinoBoss;
        if (e.isEnemyDead()) return;

        const pBody = p.body as Phaser.Physics.Arcade.Body;

        // Stomp check: player falling (vy > 50) AND player's feet above enemy center
        const isStomp = pBody.velocity.y > 50 && (p.y + 28) < (e.y - 4);

        if (isStomp) {
          // Stomp wins — kill/damage enemy, bounce player up
          this.lastKilledPos = { x: e.x, y: e.y };
          if (e instanceof RinoBoss) {
            // Boss stomp resistance: pass 'stomp' source so it applies 0.3× multiplier
            e.takeDamage(60, 'stomp'); // 60 × 0.3 = 18 effective damage per stomp
          } else {
            e.takeDamage(999);
          }
          p.setVelocityY(-480); // strong upward bounce
          soundFX.stomp();
          this.showPickupText('STOMP! 💥', e.x, e.y - 40, '#FFD700');
        } else if (!p.isPlayerInvincible()) {
          // Side/frontal collision — deal damage
          this.cameras.main.shake(200, 0.008);
          p.takeDamage(e.getDamage());
          soundFX.hit();
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
          soundFX.checkpoint();
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
        const e = enemy as Enemy | PlantEnemy | RinoBoss;
        if (!e.isEnemyDead() && Phaser.Geom.Rectangle.Overlaps(bounds, e.getBounds())) {
          this.lastKilledPos = { x: e.x, y: e.y };
          if (e instanceof RinoBoss) {
            e.takeDamage(damage, 'attack');
          } else {
            (e as Enemy | PlantEnemy).takeDamage(damage);
          }
        }
      });
    });

    // Enhanced enemyKilled with shake, particles, combo & score multiplier
    this.events.on('enemyKilled', (points: number) => {
      // Screen shake
      this.cameras.main.shake(100, 0.004);

      // Zoom punch — quick scale-in and back
      this.cameras.main.zoomTo(1.06, 80, 'Linear', true, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) {
          this.cameras.main.zoomTo(1.0, 120, 'Linear', true);
        }
      });

      soundFX.kill();

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

    // Boss-specific events
    this.events.on('bossDeath', (bossX: number, bossY: number) => {
      // Drop a melon (+1 life) at death position
      this.createItem(bossX, bossY - 20, 'melon', 'life');

      // Bonus score: 500 extra (on top of enemyKilled 500)
      const curScore = (this.registry.get('score') as number) || 0;
      this.registry.set('score', curScore + 500);
      this.events.emit('scoreUpdated', curScore + 500);

      this.showPickupText('+500 BONUS! 🏆', bossX, bossY - 80, '#FFD700');
    });

    this.events.on('bossGroundPoundHit', (damage: number) => {
      if (!this.player.isPlayerInvincible()) {
        this.cameras.main.shake(250, 0.01);
        this.player.takeDamage(damage);
        soundFX.hit();
        this.showPickupText('💥 GROUND POUND!', this.player.x, this.player.y - 40, '#ff4444');
      }
    });

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
        soundFX.coin();
        this.showPickupText('+10 🪙', item.x, item.y, '#FFD700');
        break;
      }
      case 'star': {
        // Instant 5x combo multiplier — lasts 15 seconds
        this.comboCount = 5;
        this.showPickupText('⭐ 5x BOOST! 15s', item.x, item.y, '#FFD700');
        if (this.comboTimer) this.comboTimer.remove();
        this.comboTimer = this.time.delayedCall(15000, () => {
          this.comboCount = 0;
        });
        // Score bonus
        const scoreStar = (this.registry.get('score') as number) || 0;
        this.registry.set('score', scoreStar + 100);
        this.events.emit('scoreUpdated', scoreStar + 100);
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
    soundFX.levelComplete();

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
    this.add.text(400, 160, '🏔️ GIPFEL ERREICHT! 🏔️', {
      fontSize: '28px',
      color: '#aaddff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setScrollFactor(0).setOrigin(0.5);
    this.add.text(400, 200, '🎉 LEVEL GESCHAFFT! 🎉', {
      fontSize: '30px',
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

    // ── Update window.gameState for automated testing ─────────────────────────
    const pb = this.player.body as Phaser.Physics.Arcade.Body;
    window.gameState = {
      playerX: Math.round(this.player.x),
      playerY: Math.round(this.player.y),
      velocityX: Math.round(pb.velocity.x),
      velocityY: Math.round(pb.velocity.y),
      health: this.player.getHealth(),
      lives: (this.registry.get('lives') as number) || 3,
      score: (this.registry.get('score') as number) || 0,
      collectedCoins: (this.registry.get('collectedCoins') as number) || 0,
      totalCoins: this.totalCoins,
      enemiesAlive: this.enemies.getChildren().filter(e => !(e as Enemy).isEnemyDead()).length,
      levelComplete: this.levelComplete,
      lastCheckpoint: (this.registry.get('lastCheckpoint') as { x: number; y: number }) || { x: 100, y: 480 },
      onFloor: pb.onFloor(),
      isWallSliding: !pb.onFloor() && (pb.blocked.left || pb.blocked.right) && pb.velocity.y > 0,
    };

    this.enemies.getChildren().forEach(enemy => {
      const e = enemy as Enemy | PlantEnemy | RinoBoss;
      if (e instanceof RinoBoss) {
        e.update(this.player.x, this.player.y);
      } else if (e instanceof PlantEnemy) {
        e.update(this.player.x, this.player.y);
      } else {
        (e as Enemy).update();
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

    // ⚠️ Boss Arena banner at x > 5400
    if (px > 5400 && !this.bossArenaShown) {
      this.bossArenaShown = true;
      this.cameras.main.shake(200, 0.006);
      this.showZoneBanner('⚠️ BOSS ARENA — Viel Glück!');
    }
  }
}
