import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const directory = path.resolve(process.argv[2] || 'web-build');
const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
assert.ok(html.includes('id="am-startup"'), 'Prepare startup recovery before testing.');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  for (const mode of (process.env.STARTUP_CASE ? [process.env.STARTUP_CASE] : ['normal', 'class-sdk', 'notifications-paused', 'missing-bundle', 'broken-bundle', 'stalled-bundle'])) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    const pushRequests = [];
    page.on('request', request => { if (request.url().includes('onesignal.com')) pushRequests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (mode === 'class-sdk' && url.href === 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js') {
        return route.fulfill({contentType: 'application/javascript', body: `
          class OneSignal {
            static init = async () => {};
            static Notifications = {isPushSupported: () => true};
            static User = {addTags: () => {}, PushSubscription: {
              optedIn: false,
              optIn() { window.__pushOptInCalls = (window.__pushOptInCalls || 0) + 1; this.optedIn = true; },
              optOut() { window.__pushOptOutCalls = (window.__pushOptOutCalls || 0) + 1; this.optedIn = false; },
              addEventListener() {}, removeEventListener() {}
            }};
          }
          window.OneSignal = OneSignal;
          for (const callback of window.OneSignalDeferred || []) callback(OneSignal);
        `});
      }
      if (url.origin !== 'https://app.aminvestmentswv.com') return route.abort();
      if (url.pathname === '/') return route.fulfill({contentType: 'text/html', body: html});
      if (url.pathname === '/home-screen-check/app.html') return route.fulfill({path: path.join(directory, 'home-screen-check/app.html')});
      if (url.pathname.endsWith('.js')) {
        if (mode === 'missing-bundle') return route.abort();
        if (mode === 'broken-bundle') return route.fulfill({contentType: 'application/javascript', body: 'throw new Error("Startup regression fixture");'});
        if (mode === 'stalled-bundle') return route.fulfill({contentType: 'application/javascript', body: '/* no app mounted */'});
        return route.fulfill({path: path.join(directory, url.pathname)});
      }
      return route.abort();
    });
    await page.goto(mode === 'notifications-paused' ? 'https://app.aminvestmentswv.com/home-screen-check/app.html?am-push=off' : 'https://app.aminvestmentswv.com/?launch=homescreen&property=removed-property', {waitUntil: 'load'});
    if (mode === 'normal' || mode === 'class-sdk' || mode === 'notifications-paused') {
      await page.getByRole('heading', {name: 'Find your opportunity', exact: true}).waitFor();
      await page.waitForFunction(() => !document.getElementById('am-startup'));
      assert.deepEqual(errors, []);
      if (mode === 'class-sdk') {
        const enable = page.getByRole('button', {name: 'Enable notifications', exact: true});
        await enable.waitFor({state: 'visible', timeout: 4000});
        assert.ok(await enable.isEnabled());
        assert.equal(await page.evaluate(() => window.__pushOptInCalls || 0), 0, 'Initialization must not opt in');
        await enable.click();
        await page.getByText('Notifications are on for your selection.', {exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.__pushOptInCalls), 1);
        await page.getByRole('radio', {name: 'None', exact: true}).click();
        await page.getByText('No property notifications selected.', {exact: true}).waitFor();
        assert.equal(await page.evaluate(() => window.__pushOptOutCalls), 1);
        assert.deepEqual(errors, []);
      }
      if (mode === 'notifications-paused') {
        await page.getByText('App test: ready', {exact: true}).waitFor();
        await page.getByText('Notifications are paused for this test.', {exact: false}).waitFor();
        assert.equal(await page.getByRole('radio').count(), 0);
        assert.equal(await page.getByRole('button', {name: 'Enable notifications', exact: true}).count(), 0);
        assert.deepEqual(pushRequests, [], 'The paused test must never load OneSignal');
      }
    } else {
      if (mode === 'stalled-bundle') await page.clock.fastForward(21000);
      const expected = {'missing-bundle': 'AM-LOAD-01', 'broken-bundle': 'AM-START-02', 'stalled-bundle': 'AM-START-03'}[mode];
      await page.getByText(expected, {exact: false}).waitFor();
      const retry = page.getByRole('link', {name: 'Reload app', exact: true});
      assert.ok(await retry.isVisible());
      const url = new URL(await retry.getAttribute('href'));
      assert.equal(url.searchParams.get('property'), 'removed-property');
      assert.ok(url.searchParams.has('am-reload'));
    }
    console.log(`Startup verified: ${mode}`);
    await context.close();
  }
} finally { await browser.close(); }
