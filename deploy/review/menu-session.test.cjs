const { chromium } = require('../../apps/miniapp/node_modules/@playwright/test');
const assert = require('node:assert/strict');

// Supply the review shell URL. This uses the real iframe and Lab, without routing.
(async () => {
  const url = process.argv[2];
  assert.ok(url, 'provide the review shell URL');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.locator('iframe.ready').waitFor({ timeout: 120000 });
    const wallet = page.frameLocator('#app');
    await wallet.locator('[data-review-motion-launch][data-review-motion-ready="true"]').waitFor({ state: 'attached', timeout: 120000 });
    assert.equal(await wallet.getByRole('button', { name: 'Настройки движения для этого кошелька' }).count(), 0);
    await page.waitForFunction(() => document.querySelector('#motion-link').getAttribute('aria-disabled') === 'false');
    await page.locator('#review-links summary').focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Настройки движения — Motion Lab' }).focus();
    const opened = context.waitForEvent('page', { timeout: 10000 });
    await page.keyboard.press('Enter');
    const lab = await opened;
    await lab.waitForURL(/\/design-lab\/motion\?/, { timeout: 30000 });
    const session = new URL(lab.url());
    assert.ok(session.searchParams.get('session'));
    assert.equal(session.searchParams.get('target'), 'mono.quick-actions');
    await lab.getByRole('spinbutton', { name: 'Мягкость возврата' }).fill('240', { timeout: 120000 });
    await lab.getByRole('button', { name: 'Применить к локальной примерке MONO' }).click();
    await lab.getByText(/MONO подтвердил применение/).waitFor({ timeout: 60000 });
    const motion = await wallet.locator('.mono-preview-frame').evaluate(element => getComputedStyle(element).getPropertyValue('--motion-linked-card').trim());
    assert.equal(motion, '240ms');
    assert.deepEqual(errors, []);
    console.log('KEYBOARD_SESSION_APPLY_PASS', JSON.stringify({ origin: session.origin, target: 'mono.quick-actions', motion }));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
