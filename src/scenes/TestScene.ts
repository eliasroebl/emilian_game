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
import { Enemy } from '../entities/Enemy';

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

          // Done!
          this.time.delayedCall(300, () => this.finishTests());
        });
      });
    } else {
      this.assert('gamescene-player-accessible', false,
        'Could not access GameScene.player');
      this.finishTests();
    }
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
