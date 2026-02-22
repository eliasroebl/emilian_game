import { test, expect } from '@playwright/test';

test.describe('Krone des Gingers - Game Tests', () => {
  test.setTimeout(60000);

  test('automated in-game test suite passes', async ({ page }) => {
    // Capture browser console output for visibility
    page.on('console', msg => {
      if (msg.text().includes('[TEST')) {
        console.log('[Browser]', msg.text());
      }
    });

    await page.goto('http://localhost:5173/emilian_game/emilian_game/?test=1');

    // Wait for test suite to complete (max 45s — game boots + tests run ~10s)
    await page.waitForFunction(
      () => (window as unknown as { testResults?: { done: boolean } }).testResults?.done === true,
      { timeout: 45000 },
    );

    const testResults = await page.evaluate(
      () =>
        (
          window as unknown as {
            testResults: {
              passed: number;
              failed: number;
              tests: Array<{ name: string; passed: boolean; message: string }>;
            };
          }
        ).testResults,
    );

    console.log('\nTest results summary:');
    for (const t of testResults.tests) {
      console.log(`  ${t.passed ? '✅' : '❌'} ${t.name}: ${t.message}`);
    }
    console.log(`\nTotal: ${testResults.passed} passed, ${testResults.failed} failed`);

    expect(testResults.failed).toBe(0);
  });

  test('gameState bridge is exposed once GameScene starts', async ({ page }) => {
    page.on('console', msg => {
      if (msg.text().includes('[TEST')) {
        console.log('[Browser]', msg.text());
      }
    });

    await page.goto('http://localhost:5173/emilian_game/emilian_game/?test=1');

    // Wait for GameScene to boot (TestScene launches it after 1.5s)
    await page.waitForFunction(
      () => typeof (window as unknown as { gameState?: object }).gameState !== 'undefined',
      { timeout: 15000 },
    );

    const gameState = await page.evaluate(
      () => (window as unknown as { gameState: Record<string, unknown> }).gameState,
    );

    console.log('gameState snapshot:', JSON.stringify(gameState));
    expect(typeof gameState.playerX).toBe('number');
    expect(typeof gameState.health).toBe('number');
    expect(typeof gameState.totalCoins).toBe('number');
  });
});
