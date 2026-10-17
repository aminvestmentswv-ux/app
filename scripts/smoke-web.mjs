import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

assert.ok(existsSync('dist/index.html'), 'Run npm run build:web before the UI smoke test.');
const snapshot = JSON.parse(readFileSync('src/data/properties.json', 'utf8'));
const available = snapshot.properties.filter((p) => p.status === 'available');
const soldProperties = snapshot.properties.filter((p) => p.status === 'sold');
assert.ok(available.length && soldProperties.length, 'The selected inventory exercises available and sold workflows.');

const port = Number(process.env.SMOKE_PORT || 8765);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', 'dist'], {
  stdio: ['ignore', 'ignore', 'pipe'],
});
let serverError = '';
server.stderr.on('data', (data) => { serverError += data.toString(); });
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (server.exitCode !== null) throw new Error(`Static server failed: ${serverError}`);
    try {
      ready = (await fetch(`http://127.0.0.1:${port}`)).ok;
      if (ready) break;
    } catch { /* Wait briefly for the server we just started. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Static server did not become ready.');

  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ||
    (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // This suite deliberately verifies that blocked photos do not break browsing.
  // Source-photo network access is reported separately; it is not mocked as a success.
  await page.route(/https:\/\/(?:image-cdn|cdn)\.carrot\.com\//, (route) => route.abort());
  await page.addInitScript(() => {
    window.open = (url) => { window.__openedWebsite = String(url); return null; };
  });

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: 'Available', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 3);
    assert.equal(await page.getByRole('tab', { name: 'Available', exact: true }).getAttribute('aria-selected'), 'true');

    for (const label of ['Under Contract', 'Sold', 'Available']) {
      const tab = page.getByRole('tab', { name: label, exact: true });
      await tab.click();
      assert.equal(await tab.getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('tab', { selected: true }).count(), 1);
      assert.ok(await page.getByRole('heading', { name: `${label} properties`, exact: true }).isVisible());
      const status = { Available: 'available', 'Under Contract': 'under-contract', Sold: 'sold' }[label];
      const count = snapshot.properties.filter((p) => p.status === status).length;
      assert.equal(await page.getByRole('button', { name: /^View / }).count(), Math.min(count, 12));
    }

    const search = page.getByRole('textbox', { name: 'Search properties by address or city' });
    await search.fill(available[0].city);
    assert.ok(await page.getByRole('button', { name: `View ${available[0].address}`, exact: true }).isVisible());
    assert.equal(await page.getByRole('button', { name: /^View / }).count(), available.filter((p) => `${p.address} ${p.city} ${p.state}`.toLowerCase().includes(available[0].city.toLowerCase())).length);
    await search.fill('no-such-property-xyz');
    assert.ok(await page.getByRole('heading', { name: 'No matching properties' }).isVisible());
    await page.getByRole('button', { name: 'Clear search', exact: true }).first().click();
    assert.equal(await page.getByRole('button', { name: /^View / }).count(), available.length);

    await page.getByRole('button', { name: `View ${available[0].address}`, exact: true }).click();
    const details = page.getByRole('dialog', { name: `${available[0].address} property details` });
    await details.waitFor();
    assert.ok(await details.getByRole('heading', { name: available[0].address, exact: true }).isVisible());
    assert.equal(await details.getByRole('link', { name: 'Call AM Investments about this property' }).count(), 1);
    assert.equal(await details.getByText('Contact for pricing', { exact: true }).count(), 0);
    await details.getByText('Photo 1 of ' + available[0].images.length, { exact: true }).waitFor();
    await details.getByRole('button', { name: 'Next photo', exact: true }).click();
    await details.getByText('Photo 2 of ' + available[0].images.length, { exact: true }).waitFor();
    await details.getByRole('button', { name: 'Previous photo', exact: true }).click();
    await details.getByText('Photo 1 of ' + available[0].images.length, { exact: true }).waitFor();
    await details.getByText('Photo unavailable', { exact: true }).waitFor();
    await details.getByRole('link', { name: 'View original property listing' }).click();
    assert.equal(await page.evaluate(() => window.__openedWebsite), available[0].detailsUrl);
    await details.getByRole('button', { name: 'Close property details' }).click();
    await details.waitFor({ state: 'detached' });

    await page.getByRole('tab', { name: 'Sold', exact: true }).click();
    await page.getByRole('button', { name: `View ${soldProperties[0].address}`, exact: true }).click();
    const soldDetails = page.getByRole('dialog', { name: `${soldProperties[0].address} property details` });
    await soldDetails.waitFor();
    assert.equal(await soldDetails.getByRole('link', { name: 'Call AM Investments about this property' }).count(), 0);
    assert.ok(await soldDetails.getByText('This property is sold. It is not listed as available to buy.', { exact: true }).isVisible());
    await soldDetails.getByRole('button', { name: 'Browse available properties' }).click();
    assert.equal(await page.getByRole('tab', { name: 'Available', exact: true }).getAttribute('aria-selected'), 'true');

    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow at ${width}px`);
    console.log(`PASS ${width}px: actual inventory, status tabs, search, available/sold details, galleries, source links, failed-photo fallback, no horizontal overflow`);
  }

  const sold = page.getByRole('tab', { name: 'Sold', exact: true });
  await sold.focus();
  await page.keyboard.press('Enter');
  assert.equal(await sold.getAttribute('aria-selected'), 'true');

  if (soldProperties.length > 12) {
    await page.getByRole('button', { name: /Show more properties/ }).click();
    assert.equal(await page.getByRole('button', { name: /^View / }).count(), Math.min(24, soldProperties.length));
  }

  await page.getByRole('link', { name: 'Open official AM Investments website', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__openedWebsite), new URL('https://www.aminvestmentswv.com').href);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  await page.setViewportSize({ width: 390, height: 1200 });
  await page.getByRole('tab', { name: 'Available', exact: true }).click();
  await page.getByRole('heading', { name: /Your next chapter/ }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelectorAll('*').forEach((element) => { if (element.scrollTop) element.scrollTop = 0; }));
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  console.log('PASS keyboard activation, archive pagination, official website action, and browser runtime checks');
  console.log('Screenshot: test-results/mobile.png');
} finally {
  await browser?.close();
  server.kill();
}
