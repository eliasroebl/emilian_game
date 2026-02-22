import { test, expect } from '@playwright/test';

test.describe('Krone des Gingers - Game Tests', () => {
  test.setTimeout(90000);

  test('automated in-game test suite passes', async ({ page }) => {
    // Capture console output for debugging
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      if (text.includes('[TEST') || text.includes('[TestScene')) {
        console.log('Game:', text);
      }
    });
    page.on('pageerror', err => console.error('Page error:', err.message));

    await page.goto('http://localhost:5173/emilian_game/?test=1');
    console.log('Page loaded, waiting for test suite...');

    // Wait up to 60s for testResults.done
    let testResults;
    try {
      await page.waitForFunction(
        () => (window as unknown as { testResults?: { done: boolean } }).testResults?.done === true,
        { timeout: 60000 },
      );
      testResults = await page.evaluate(
        () => (window as unknown as {
          testResults: { passed: number; failed: number; tests: Array<{ name: string; passed: boolean; message: string }> }
        }).testResults
      );
    } catch {
      // Timeout — dump what we know
      const partial = await page.evaluate(
        () => (window as unknown as { testResults?: object; gameState?: object }).testResults
      );
      const gs = await page.evaluate(
        () => (window as unknown as { gameState?: object }).gameState
      );
      console.log('TIMEOUT! Partial testResults:', JSON.stringify(partial));
      console.log('Current gameState:', JSON.stringify(gs));
      console.log('All console logs:\n', logs.join('\n'));
      throw new Error('Test suite timed out — see logs above');
    }

    console.log('\n=== Test Results ===');
    for (const t of testResults.tests) {
      console.log(`  ${t.passed ? '✅' : '❌'} ${t.name}: ${t.message}`);
    }
    console.log(`Total: ${testResults.passed} passed, ${testResults.failed} failed`);

    expect(testResults.failed, `${testResults.failed} tests failed`).toBe(0);
  });

  test('gameState bridge is exposed once GameScene starts', async ({ page }) => {
    page.on('pageerror', err => console.error('Page error:', err.message));

    // Navigate with test=1 so GameScene starts directly
    await page.goto('http://localhost:5173/emilian_game/?test=1');

    // Wait for gameState (GameScene initializes it in create())
    await page.waitForFunction(
      () => typeof (window as unknown as { gameState?: object }).gameState !== 'undefined',
      { timeout: 20000 },
    );

    const gs = await page.evaluate(
      () => (window as unknown as { gameState: Record<string, unknown> }).gameState
    );

    console.log('gameState:', JSON.stringify(gs, null, 2));

    expect(gs).toBeDefined();
    expect(typeof gs.playerX).toBe('number');
    expect(typeof gs.health).toBe('number');
    expect(typeof gs.enemiesAlive).toBe('number');
    expect(gs.levelComplete).toBe(false);
  });

  test('level extension — 12000px world, goal at summit, 35+ enemies, 45+ coins', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
    });
    page.on('pageerror', err => console.error('Page error:', err.message));

    await page.goto('http://localhost:5173/emilian_game/?test=1');

    let testResults;
    try {
      await page.waitForFunction(
        () => (window as unknown as { testResults?: { done: boolean } }).testResults?.done === true,
        { timeout: 60000 },
      );
      testResults = await page.evaluate(
        () => (window as unknown as {
          testResults: {
            passed: number;
            failed: number;
            tests: Array<{ name: string; passed: boolean; message: string }>;
          }
        }).testResults
      );
    } catch {
      console.log('TIMEOUT! Console logs:\n', logs.join('\n'));
      throw new Error('Level extension test timed out');
    }

    // Filter level extension tests
    const levelTests = testResults.tests.filter(t => t.name.startsWith('level-'));

    console.log('\n=== Level Extension Test Results ===');
    for (const t of levelTests) {
      console.log(`  ${t.passed ? '✅' : '❌'} ${t.name}: ${t.message}`);
    }

    const failedLevel = levelTests.filter(t => !t.passed);
    expect(
      failedLevel.length,
      `Failed level tests: ${failedLevel.map(t => `${t.name}: ${t.message}`).join(', ')}`,
    ).toBe(0);

    // Verify specific level extension properties via gameState
    const gs = await page.evaluate(
      () => (window as unknown as { gameState: Record<string, unknown> }).gameState
    );
    expect(gs.totalCoins as number).toBeGreaterThanOrEqual(45);
    expect(gs.enemiesAlive as number).toBeGreaterThanOrEqual(35);
  });

  test('RinoBoss mini-boss — exists, has phases, charge, stomp resistance', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
    });
    page.on('pageerror', err => console.error('Page error:', err.message));

    // Use test=1 mode which runs all tests including mini-boss tests
    await page.goto('http://localhost:5173/emilian_game/?test=1');

    // Wait for full test suite to complete (includes mini-boss tests)
    let testResults;
    try {
      await page.waitForFunction(
        () => (window as unknown as { testResults?: { done: boolean } }).testResults?.done === true,
        { timeout: 60000 },
      );
      testResults = await page.evaluate(
        () => (window as unknown as {
          testResults: {
            passed: number;
            failed: number;
            tests: Array<{ name: string; passed: boolean; message: string }>;
          }
        }).testResults
      );
    } catch {
      console.log('TIMEOUT! Console logs:\n', logs.join('\n'));
      throw new Error('Mini-boss test suite timed out');
    }

    // Filter only mini-boss tests
    const bossTetsts = testResults.tests.filter(t => t.name.startsWith('miniboss-'));

    console.log('\n=== Mini-Boss Test Results ===');
    for (const t of bossTetsts) {
      console.log(`  ${t.passed ? '✅' : '❌'} ${t.name}: ${t.message}`);
    }

    // Assert all mini-boss tests passed
    const failedBoss = bossTetsts.filter(t => !t.passed);
    expect(
      failedBoss.length,
      `Failed mini-boss tests: ${failedBoss.map(t => `${t.name}: ${t.message}`).join(', ')}`,
    ).toBe(0);

    // Assert boss-specific behaviors
    const bossExists = bossTetsts.find(t => t.name === 'miniboss-exists');
    expect(bossExists?.passed, 'RinoBoss should exist in level').toBe(true);

    const bossHP = bossTetsts.find(t => t.name === 'miniboss-hp-high');
    expect(bossHP?.passed, 'RinoBoss should have HP > 100').toBe(true);
  });
});
