/**
 * TestScene — in-game automated test harness.
 * Activated via URL param: ?test=1
 * 
 * Tests the game by directly manipulating Phaser registry/player state
 * instead of simulating keyboard input (which Phaser ignores from JS).
 * 
 * Results exposed on window.testResults for Playwright to read.
 */
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, RinoBoss } from '../entities/Enemy';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

declare global {
  interface Window {
    testResults: {
      done: boolean;
      passed: number;
      failed: number;
      tests: TestResult[];
    };
  }
}

export class TestScene extends Phaser.Scene {
  private results: TestResult[] = [];

  constructor() { super({ key: 'TestScene' }); }

  create(): void {
    // Initialize testResults immediately so Playwright can detect we're alive
    window.testResults = { done: false, passed: 0, failed: 0, tests: [] };

    console.log('[TestScene] Starting — launching GameScene + UIScene');

    // Launch GameScene underneath
    this.registry.set('playerName', 'TestRunner');
    this.registry.set('currentWorld', 'EARTH');
    this.registry.set('lives', 3);
    this.registry.set('health', 100);
    this.registry.set('score', 0);
    this.registry.set('attackBoost', 1);
    this.registry.set('defenseBoost', 1);

    this.scene.launch('GameScene');
    this.scene.launch('UIScene');

    // Wait for GameScene to fully boot (assets load, player spawns)
    this.time.delayedCall(2500, () => {
      console.log('[TestScene] GameScene should be ready, running tests...');
      this.runAllTests();
    });
  }

  private assert(name: string, condition: boolean, message: string): void {
    this.results.push({ name, passed: condition, message });
    console.log(`[TEST] ${condition ? '✅' : '❌'} ${name}: ${message}`);
  }

  private runAllTests(): void {
    // ── Test 1: window.gameState is initialized ────────────────────────────
    const gs = window.gameState;
    if (!gs) {
      this.assert('gamestate-exists', false, 'window.gameState is undefined — GameScene did not initialize');
      this.finishTests();
      return;
    }
    this.assert('gamestate-exists', true, 'window.gameState is defined');

    // ── Test 2: Player spawned at correct position ─────────────────────────
    this.assert('player-spawn-x', gs.playerX > 50 && gs.playerX < 250,
      `playerX=${gs.playerX} (expected 50–250)`);
    this.assert('player-spawn-y', gs.playerY > 300 && gs.playerY < 600,
      `playerY=${gs.playerY} (expected 300–600)`);

    // ── Test 3: Player stats ───────────────────────────────────────────────
    this.assert('player-health', gs.health === 100, `health=${gs.health}`);
    this.assert('player-lives', gs.lives === 3, `lives=${gs.lives}`);
    this.assert('player-score-zero', gs.score === 0, `score=${gs.score}`);

    // ── Test 4: Player on floor ────────────────────────────────────────────
    this.assert('player-on-floor', gs.onFloor, `onFloor=${gs.onFloor}`);

    // ── Test 5: Level content ──────────────────────────────────────────────
    this.assert('coins-exist', gs.totalCoins > 0,
      `totalCoins=${gs.totalCoins} (expected >0)`);
    this.assert('enemies-exist', gs.enemiesAlive > 0,
      `enemiesAlive=${gs.enemiesAlive} (expected >0)`);
    this.assert('level-not-complete', !gs.levelComplete,
      `levelComplete=${gs.levelComplete}`);

    // ── Test 6: Checkpoint starts at spawn ────────────────────────────────
    this.assert('checkpoint-default-x', gs.lastCheckpoint.x <= 150,
      `lastCheckpoint.x=${gs.lastCheckpoint.x}`);

    // ── Test 7: Directly move player and verify gameState updates ──────────
    // Get the actual GameScene and player object
    const gameScene = this.scene.get('GameScene') as Phaser.Scene & {
      player?: Player;
      enemies?: Phaser.Physics.Arcade.Group;
    };

    if (gameScene && gameScene.player) {
      const player = gameScene.player;
      const startX = player.x;

      // Directly set velocity to simulate movement
      const body = player.body as Phaser.Physics.Arcade.Body;
      body.setVelocityX(200);

      // Check after 500ms that player moved
      this.time.delayedCall(500, () => {
        const newGs = window.gameState;
        const moved = newGs.playerX > startX;
        this.assert('player-moves-when-velocity-set', moved,
          `x: ${Math.round(startX)} → ${newGs.playerX}`);

        // Stop player
        body.setVelocityX(0);

        // ── Test 8: Verify enemy count matches enemies group ───────────────
        if (gameScene.enemies) {
          const aliveCount = gameScene.enemies.getChildren()
            .filter(e => !(e as Enemy).isEnemyDead()).length;
          this.assert('enemy-count-matches', aliveCount === newGs.enemiesAlive,
            `group=${aliveCount}, gameState=${newGs.enemiesAlive}`);
        }

        // ── Test 9: Registry health matches gameState ──────────────────────
        const regHealth = player.getHealth();
        this.assert('health-consistent', regHealth === newGs.health,
          `player.getHealth()=${regHealth}, gameState.health=${newGs.health}`);

        // ── Test 10: Simulate jump via direct velocity ─────────────────────
        body.setVelocityY(-400);
        this.time.delayedCall(150, () => {
          const jumpGs = window.gameState;
          this.assert('jump-vy-negative', jumpGs.velocityY < 0,
            `velocityY=${jumpGs.velocityY}`);
          this.assert('jump-not-on-floor', !jumpGs.onFloor,
            `onFloor=${jumpGs.onFloor}`);

          // Done with movement tests — run mini-boss tests next
          this.time.delayedCall(300, () => this.testMiniBoss(gameScene));
        });
      });
    } else {
      this.assert('gamescene-player-accessible', false,
        'Could not access GameScene.player');
      this.finishTests();
    }
  }

  private testMiniBoss(gameScene: Phaser.Scene & {
    player?: Player;
    enemies?: Phaser.Physics.Arcade.Group;
  }): void {
    console.log('[TestScene] Running mini-boss tests...');

    if (!gameScene.enemies) {
      this.assert('miniboss-enemies-group', false, 'No enemies group found in GameScene');
      this.finishTests();
      return;
    }

    // Find RinoBoss in enemies group (should be near x=5580)
    const allEnemies = gameScene.enemies.getChildren();
    const rinoBoss = allEnemies.find(e => e instanceof RinoBoss) as RinoBoss | undefined;

    // ── Test MB-1: RinoBoss exists in the level ────────────────────────────
    this.assert('miniboss-exists', !!rinoBoss,
      rinoBoss ? `Found RinoBoss at x=${Math.round(rinoBoss.x)}` : 'No RinoBoss found in enemies group');

    if (!rinoBoss) {
      this.finishTests();
      return;
    }

    // ── Test MB-2: HP > 100 (boss tier health) ────────────────────────────
    this.assert('miniboss-hp-high', rinoBoss.getMaxHP() > 100,
      `maxHP=${rinoBoss.getMaxHP()} (expected >100)`);

    // ── Test MB-3: getPhase() returns 1, 2, or 3 ──────────────────────────
    const phase = rinoBoss.getPhase();
    this.assert('miniboss-getphase', phase >= 1 && phase <= 3,
      `getPhase()=${phase} (expected 1, 2, or 3)`);

    // ── Test MB-4: Boss is larger than normal mushroom (scale >= 2.5) ──────
    this.assert('miniboss-scale-large', rinoBoss.scaleX >= 2.5,
      `scaleX=${rinoBoss.scaleX} (expected >= 2.5)`);

    // ── Test MB-5: Phase 1 at full HP ─────────────────────────────────────
    this.assert('miniboss-phase1-at-start', rinoBoss.getPhase() === 1,
      `Phase at full HP should be 1, got ${rinoBoss.getPhase()}`);

    // ── Test MB-6: Phase transitions at HP thresholds ─────────────────────
    // Simulate dropping HP to phase 2 threshold (≤200 = 66% of 300)
    const maxHP = rinoBoss.getMaxHP();
    const phase2HP = Math.floor(maxHP * 0.66) + 1; // just above threshold
    // Force HP to trigger phase 2 (66% threshold = 200 HP for 300 max)
    // Deal damage to bring it to phase 2 level
    const damageToPhase2 = rinoBoss.getCurrentHP() - 199;
    if (damageToPhase2 > 0) {
      rinoBoss.takeDamage(damageToPhase2, 'test');
    }
    void phase2HP; // suppress unused warning
    this.assert('miniboss-phase2-threshold', rinoBoss.getPhase() === 2,
      `Phase at 199 HP should be 2, got ${rinoBoss.getPhase()} (currentHP=${rinoBoss.getCurrentHP()})`);

    // Simulate dropping HP to phase 3 threshold (≤100 = 33% of 300)
    const damageToPhase3 = rinoBoss.getCurrentHP() - 99;
    if (damageToPhase3 > 0) {
      rinoBoss.takeDamage(damageToPhase3, 'test');
    }
    this.assert('miniboss-phase3-threshold', rinoBoss.getPhase() === 3,
      `Phase at 99 HP should be 3, got ${rinoBoss.getPhase()} (currentHP=${rinoBoss.getCurrentHP()})`);

    // ── Test MB-7: isCharging() method exists and returns boolean ──────────
    const charging = rinoBoss.isCharging();
    this.assert('miniboss-ischarging', typeof charging === 'boolean',
      `isCharging()=${charging} (expected boolean)`);

    // ── Test MB-8: Stomp does reduced damage (stomp resistance) ───────────
    // Reset HP to a known value to test stomp multiplier
    const hpBefore = rinoBoss.getCurrentHP();
    rinoBoss.takeDamage(100, 'stomp');
    const hpAfter = rinoBoss.getCurrentHP();
    const actualDamage = hpBefore - hpAfter;
    // Stomp multiplier = 0.3, so 100 stomp damage → 30 actual damage
    this.assert('miniboss-stomp-resistance', actualDamage < 100,
      `Stomp 100 dmg dealt ${actualDamage} actual damage (expected <100 due to 0.3× resistance)`);

    this.testLevelExtension(gameScene);
  }

  private testLevelExtension(gameScene: Phaser.Scene & {
    player?: Player;
    enemies?: Phaser.Physics.Arcade.Group;
    goalSprite?: Phaser.Physics.Arcade.Sprite;
    checkpoints?: Phaser.Physics.Arcade.StaticGroup;
    totalCoins?: number;
  }): void {
    console.log('[TestScene] Running level extension tests...');

    // ── Test LE-1: World bounds width >= 11000 ────────────────────────────
    // Read world bounds from GameScene's physics world, not TestScene's
    const gameSceneForBounds = this.scene.get('GameScene') as Phaser.Scene;
    const worldWidth = (gameSceneForBounds?.physics as Phaser.Physics.Arcade.ArcadePhysics)?.world?.bounds?.width ?? this.physics.world.bounds.width;
    this.assert('level-world-width', worldWidth >= 11000,
      `world.bounds.width=${worldWidth} (expected >= 11000)`);

    // ── Test LE-2: Goal sprite at x >= 11000 ─────────────────────────────
    const goal = gameScene.goalSprite;
    if (goal) {
      this.assert('level-goal-x', goal.x >= 11000,
        `goalSprite.x=${Math.round(goal.x)} (expected >= 11000)`);
    } else {
      this.assert('level-goal-x', false, 'goalSprite not accessible from GameScene');
    }

    // ── Test LE-3: Total enemies >= 35 ───────────────────────────────────
    if (gameScene.enemies) {
      const totalEnemies = gameScene.enemies.getChildren().length;
      this.assert('level-enemy-count', totalEnemies >= 35,
        `total enemies=${totalEnemies} (expected >= 35)`);
    } else {
      this.assert('level-enemy-count', false, 'enemies group not accessible');
    }

    // ── Test LE-4: Total coins >= 45 ─────────────────────────────────────
    const totalCoins = (gameScene as unknown as { totalCoins?: number }).totalCoins ?? 0;
    this.assert('level-coin-count', totalCoins >= 45,
      `totalCoins=${totalCoins} (expected >= 45)`);

    // ── Test LE-5: Checkpoint exists at x >= 6000 ────────────────────────
    const checkpoints = gameScene.checkpoints;
    let hasLateCheckpoint = false;
    if (checkpoints) {
      // Check registry-based approach: check if any cp was at x >= 6000
      // Checkpoints are destroyed on touch so we check the static group children
      // or infer from gameState.lastCheckpoint if player already passed one
      const cpChildren = checkpoints.getChildren();
      // Also check initial checkpoint positions from existing children
      for (const cp of cpChildren) {
        const s = cp as Phaser.Physics.Arcade.Sprite;
        if (s.x >= 6000) {
          hasLateCheckpoint = true;
          break;
        }
      }
      // If player has already activated a late checkpoint, verify via gameState
      const gs = window.gameState;
      if (gs && gs.lastCheckpoint && gs.lastCheckpoint.x >= 6000) {
        hasLateCheckpoint = true;
      }
    }
    this.assert('level-late-checkpoint', hasLateCheckpoint,
      `Found checkpoint at x >= 6000: ${hasLateCheckpoint}`);

    this.finishTests();
  }

  private finishTests(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    window.testResults = { done: true, passed, failed, tests: this.results };
    console.log(`[TEST SUITE COMPLETE] ${passed} passed, ${failed} failed`);

    // Visual overlay
    const bg = this.add.rectangle(400, 300, 780, 580, 0x000000, 0.92)
      .setScrollFactor(0).setDepth(50);
    void bg;

    const color = failed > 0 ? '#ff4444' : '#44ff44';
    this.add.text(400, 25, `🧪 Test Results: ${passed}✅ ${failed}❌`, {
      fontSize: '20px', color,
      stroke: '#000', strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5).setDepth(51);

    this.results.forEach((r, i) => {
      this.add.text(16, 55 + i * 26, `${r.passed ? '✅' : '❌'} ${r.name}: ${r.message}`, {
        fontSize: '13px',
        color: r.passed ? '#aaffaa' : '#ffaaaa',
      }).setScrollFactor(0).setDepth(51);
    });
  }
}
