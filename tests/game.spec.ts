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
});
