/**
 * GameScene — Level 1: "Das große Abenteuer"
 *
 * Level design philosophy:
 *   Zone 1 (Tutorial):  Walk, discover jump, meet first enemy (slow mushroom)
 *   Zone 2 (Platforms): Learn to chain jumps — a staircase of rising platforms
 *   Zone 3 (Chimney):   OPTIONAL wall-jump section — two walls players can climb
 *                        for an extra life (Melon). If they ignore it, the ground
 *                        path continues freely beneath the walls.
 *   Zone 4 (Plants):    First ranged enemy (plant that shoots) + platform mix
 *   Zone 5 (Rush):      Challenge with every enemy type, leads to the end flag
 *
 * Physics reference (at scale 2×):
 *   Player body: 40×56 px world units.  sprite.y = body_bottom - 32.
 *   Standing on ground (tile y=550): sprite.y ≈ 510, body [486, 542]
 *   Standing on platform y_tile:     sprite.y = y_tile - 40
 *   Normal jump apex:  ~100 px above standing position
 *   Wall jump:         same apex height + horizontal kick of 180 px/s
 *   Chimney wall bottom tile at y=460 → tile bottom at y=468 < player body
 *   top at y=486 when on ground → player walks freely beneath the walls.
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
    this.physics.world.setBounds(0, 0, 2700, 600);
    this.cameras.main.setBounds(0, 0, 2700, 600);

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
    this.goalSprite = this.physics.add.staticSprite(2480, 478, 'end-idle');
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
  }

  // ── Platform construction ────────────────────────────────────────────────────

  private createPlatforms(): void {
    this.platforms = this.physics.add.staticGroup();

    // Full-width grass ground (y = 550, spans entire level)
    // Ground has a GAP at the required chimney (x: 1374–1486) — forces wall jump
    for (let x = 0; x < 2700; x += 16) {
      if (x + 8 >= 1374 && x + 8 <= 1486) continue; // gap under required chimney
      const t = this.platforms.create(x + 8, 550, 'terrain', GameScene.TILE_GRASS) as Phaser.Physics.Arcade.Sprite;
      t.refreshBody();
    }

    // Decorative dirt rows below ground (no physics, just visual depth)
    for (let x = 0; x < 2700; x += 16) {
      this.add.image(x + 8, 566, 'terrain', GameScene.TILE_DIRT);
      this.add.image(x + 8, 582, 'terrain', GameScene.TILE_DIRT);
    }

    // ── Zone 1 platforms (x: 0 – 700): intro hops ───────────────────────────
    //    Three progressively higher platforms teaching the jump mechanic.
    this.createPlatform(210, 488, 3);   // low hop, cherry on top
    this.createPlatform(390, 456, 4);   // second hop
    this.createPlatform(570, 424, 3);   // third hop, mushroom patrol

    // ── Zone 2 platforms (x: 700 – 1100): the staircase ─────────────────────
    //    Rising platforms with a radish on the top — first aerial enemy.
    this.createPlatform(740, 472, 3);   // step stone
    this.createPlatform(880, 424, 5);   // mid-staircase, radish here
    this.createPlatform(1030, 368, 4);  // top of staircase, apple reward

    // ── Zone 3a (x: 1100–1300): OPTIONAL chimney — teaser ───────────────────
    //    Walls stop above ground → player CAN walk under.
    //    Floating strawberry lures them in; melon waits on top as a reward.
    //    The hint text says "↑ Wandsprung?" to make them curious.
    this.createChimneyWall(1158, 268, 460);  // left wall  (bottom tile at y=468)
    this.createChimneyWall(1254, 268, 460);  // right wall (gap inner = 80 px)
    this.createPlatform(1128, 228, 10);      // top reward platform (160 px wide)

    // ── Zone 3b (x: 1350–1550): REQUIRED chimney — mandatory wall jump ───────
    //    Walls extend all the way to the ground (y=550) → player cannot pass
    //    underneath.  A wide landing platform before gives time to read the hint.
    //    Gap between walls (inner): (1478-8) − (1382+8) = 1470-1390 = 80 px
    //    Player needs 2 wall-jumps to reach the top platform.
    this.createPlatform(1280, 510, 5);       // safe landing / reading spot before chimney
    this.createChimneyWall(1382, 260, 542);  // left wall — all the way to ground
    this.createChimneyWall(1478, 260, 542);  // right wall — all the way to ground
    this.createPlatform(1350, 220, 10);      // top exit platform (160 px wide)
    //    A drop-down platform on the right side lets player descend after clearing
    this.createPlatform(1560, 400, 4);       // descent step

    // ── Zone 4 platforms (x: 1650–2000): plant territory ────────────────────
    //    Plant enemy on elevated platform + mushroom below.
    this.createPlatform(1660, 488, 4);       // recovery ground level
    this.createPlatform(1800, 440, 5);       // plant platform
    this.createPlatform(1960, 384, 4);       // high platform, radish

    // ── Zone 5 platforms (x: 2050–2500): the final rush ─────────────────────
    //    All enemy types, varied rhythm, end flag at x=2480.
    this.createPlatform(2060, 472, 3);
    this.createPlatform(2200, 416, 4);       // chicken here
    this.createPlatform(2360, 472, 3);
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
    // ─ Zone 1: two slow mushrooms — easy for a first encounter ───────────────
    const m1 = EnemyFactory.createMushroom(this, 310, 480);
    m1.setPatrolDistance(60);
    this.enemies.add(m1);

    const m2 = EnemyFactory.createMushroom(this, 600, 480);
    m2.setPatrolDistance(50);
    this.enemies.add(m2);

    // ─ Zone 2: radish on the staircase — first platform encounter ────────────
    //   Spawn slightly above platform surface so it falls and lands correctly.
    //   Platform y=424: enemy spawn y = 424 - 40 = 384.
    const r1 = EnemyFactory.createRadish(this, 912, 384);
    r1.setPatrolDistance(30);   // narrow patrol so it stays on the 5-tile platform
    this.enemies.add(r1);

    // A slow mushroom on the ground near the staircase entrance
    const m3 = EnemyFactory.createMushroom(this, 790, 480);
    m3.setPatrolDistance(40);
    this.enemies.add(m3);

    // ─ Zone 4: plant + mushroom pairing ──────────────────────────────────────
    //   Plant on elevated platform (y=440), mushroom patrolling ground below.
    const plant1 = EnemyFactory.createPlant(this, 1832, 400);
    this.plantEnemies.push(plant1);
    this.enemies.add(plant1);

    const m4 = EnemyFactory.createMushroom(this, 1690, 480);
    m4.setPatrolDistance(30);
    this.enemies.add(m4);

    // Radish on high platform (y=384): spawn y = 384 - 40 = 344.
    const r2 = EnemyFactory.createRadish(this, 1992, 344);
    r2.setPatrolDistance(25);
    this.enemies.add(r2);

    // ─ Zone 5: full mix — the final challenge ────────────────────────────────
    const m5 = EnemyFactory.createMushroom(this, 2090, 432);
    m5.setPatrolDistance(20);
    this.enemies.add(m5);

    // Chicken on mid platform (y=416): spawn y = 416 - 40 = 376.
    const c1 = EnemyFactory.createChicken(this, 2232, 376);
    c1.setPatrolDistance(30);
    this.enemies.add(c1);

    const m6 = EnemyFactory.createMushroom(this, 2400, 480);
    m6.setPatrolDistance(50);
    this.enemies.add(m6);
  }

  // ── Collectible spawning ─────────────────────────────────────────────────────

  private spawnItems(): void {
    // ─ Zone 1: reward for the first jump ─────────────────────────────────────
    this.createItem(242,  448, 'cherry',     'health');  // above first platform

    // ─ Zone 2: reward at top of staircase ────────────────────────────────────
    this.createItem(1062, 326, 'apple',      'health');  // above staircase peak

    // ─ Zone 3: chimney collectibles ──────────────────────────────────────────
    //   Strawberry floats in the middle of the chimney gap — entices the player in
    this.createItem(1204, 370, 'strawberry', 'health');
    //   Melon waits at the TOP — the grand reward for completing the wall jump
    this.createItem(1204, 186, 'melon',      'life');

    // ─ Zone 3b: reward inside required chimney — encourages attempt ──────────
    this.createItem(1430, 360, 'orange',     'attack');  // mid-chimney, floating

    // ─ Zone 4: risky apple near the plant enemy ──────────────────────────────
    this.createItem(1832, 392, 'apple',      'health');  // near plant (risky grab)
    this.createItem(1992, 344, 'kiwi',       'defense'); // on high platform

    // ─ Zone 5: final stretch rewards ─────────────────────────────────────────
    this.createItem(2232, 376, 'banana',     'attack');  // near chicken
    this.createItem(2450, 480, 'pineapple',  'health');  // right before goal
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
    // Optional chimney teaser
    this.add.text(1206, 510, '↑ Wandsprung?', {
      fontSize: '12px',
      color: '#ffe066',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Required chimney — give the player a clear hint before the wall
    this.add.text(1330, 490, '⬆ Wandsprung nötig!', {
      fontSize: '13px',
      color: '#ff6644',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // Goal marker text
    this.add.text(2480, 440, '🏁 Ziel!', {
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
