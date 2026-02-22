import Phaser from 'phaser';

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

  constructor() {
    super({ key: 'TestScene' });
  }

  create(): void {
    window.testResults = { done: false, passed: 0, failed: 0, tests: [] };

    // Start GameScene underneath (and UIScene for completeness)
    this.scene.launch('GameScene');
    this.scene.launch('UIScene');

    // Wait for GameScene to initialize before running tests
    this.time.delayedCall(1500, () => this.runTests());
  }

  private assert(name: string, condition: boolean, message: string): void {
    this.results.push({ name, passed: condition, message });
    console.log(`[TEST] ${condition ? '✅' : '❌'} ${name}: ${message}`);
  }

  private runTests(): void {
    // Kick off async chain manually using Phaser timers (no async/await)
    this.step1_playerSpawn();
  }

  // ── Test 1: Player spawned correctly ──────────────────────────────────────

  private step1_playerSpawn(): void {
    this.time.delayedCall(500, () => {
      const gs = window.gameState;
      this.assert('player-spawn', gs.playerX > 50 && gs.playerX < 200, `playerX=${gs.playerX}`);
      this.assert('player-health', gs.health === 100, `health=${gs.health}`);
      this.assert('player-lives', gs.lives === 3, `lives=${gs.lives}`);
      this.assert('player-on-floor', gs.onFloor, `onFloor=${gs.onFloor}`);
      this.step2_jump();
    });
  }

  // ── Test 2: Jump ──────────────────────────────────────────────────────────

  private step2_jump(): void {
    this.time.delayedCall(200, () => {
      this.simulateKey('Space', true);
      this.time.delayedCall(100, () => {
        this.simulateKey('Space', false);
        this.time.delayedCall(350, () => {
          const afterJump = window.gameState;
          this.assert(
            'jump-leaves-floor',
            !afterJump.onFloor || afterJump.velocityY < 0,
            `onFloor=${afterJump.onFloor}, vy=${afterJump.velocityY}`,
          );
          this.step3_moveRight();
        });
      });
    });
  }

  // ── Test 3: Player moves right ───────────────────────────────────────────

  private step3_moveRight(): void {
    this.time.delayedCall(600, () => {
      // Wait to land first
      const xBefore = window.gameState.playerX;
      this.simulateKey('ArrowRight', true);
      this.time.delayedCall(800, () => {
        this.simulateKey('ArrowRight', false);
        const xAfter = window.gameState.playerX;
        this.assert('player-moves-right', xAfter > xBefore, `x: ${xBefore} → ${xAfter}`);
        this.step4_coins();
      });
    });
  }

  // ── Test 4: Coins / enemies / score ──────────────────────────────────────

  private step4_coins(): void {
    this.time.delayedCall(200, () => {
      this.assert('coins-exist', window.gameState.totalCoins > 0, `totalCoins=${window.gameState.totalCoins}`);
      this.assert('enemies-exist', window.gameState.enemiesAlive > 0, `enemiesAlive=${window.gameState.enemiesAlive}`);
      this.assert('score-zero', window.gameState.score === 0, `score=${window.gameState.score}`);
      this.step5_advance();
    });
  }

  // ── Test 5: Player advances deeper into level ─────────────────────────────

  private step5_advance(): void {
    this.simulateKey('ArrowRight', true);
    this.time.delayedCall(3000, () => {
      this.simulateKey('ArrowRight', false);
      const xAtEnemy = window.gameState.playerX;
      this.assert('player-advanced', xAtEnemy > 200, `playerX=${xAtEnemy}`);
      this.finishTests();
    });
  }

  // ── Key simulation ────────────────────────────────────────────────────────

  private simulateKey(key: string, down: boolean): void {
    const type = down ? 'keydown' : 'keyup';
    const event = new KeyboardEvent(type, { key, code: key, bubbles: true });
    document.dispatchEvent(event);
    window.dispatchEvent(event);
  }

  // ── Final results ─────────────────────────────────────────────────────────

  private finishTests(): void {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    window.testResults = { done: true, passed, failed, tests: this.results };
    console.log(`[TEST SUITE] Done: ${passed} passed, ${failed} failed`);

    // Display overlay
    this.add.rectangle(400, 300, 780, 580, 0x000000, 0.9).setScrollFactor(0);
    this.add.text(400, 30, `Test Results: ${passed}✅ ${failed}❌`, {
      fontSize: '22px',
      color: failed > 0 ? '#ff4444' : '#44ff44',
      stroke: '#000',
      strokeThickness: 3,
    }).setScrollFactor(0).setOrigin(0.5);

    this.results.forEach((r, i) => {
      this.add.text(20, 70 + i * 30, `${r.passed ? '✅' : '❌'} ${r.name}: ${r.message}`, {
        fontSize: '14px',
        color: r.passed ? '#aaffaa' : '#ffaaaa',
      }).setScrollFactor(0);
    });
  }
}
