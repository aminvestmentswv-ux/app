/** Verify the public native feed against the exact validated Pages artifact. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { fetchPropertySnapshot } from '../src/inventoryFeed.ts';
import { parseSnapshot } from '../src/properties.ts';

class PublicFeedResponseError extends Error {
  constructor(status) {
    super(`Published inventory returned HTTP ${status}`);
    this.mayRetry = [404, 408, 429, 500, 502, 503, 504].includes(status);
  }
}

const safeMessages = new Set([
  'Inventory endpoint did not return JSON', 'Inventory redirected to an unexpected destination',
  'Inventory response is too large', 'Inventory request timed out',
  'Published inventory is not current', 'Published inventory is older than the saved inventory',
  'Invalid property snapshot', 'Invalid property snapshot metadata', 'Invalid or duplicate sale property',
  'Invalid property text', 'Invalid location flag', 'Invalid property number',
  'Invalid property source status or owner correction', 'Invalid property image URL', 'Invalid property images',
  'Published inventory differs from the verified Pages artifact',
]);
function safeFailure(error) {
  if (error instanceof PublicFeedResponseError || safeMessages.has(error?.message)) return error.message;
  if (error instanceof SyntaxError) return 'Published inventory contains invalid JSON';
  return 'Published inventory request failed or response was invalid';
}

export async function verifyPublishedInventory(expected, {
  fetcher, now = Date.now, attempts = 6, timeoutMs = 12_000, delayMs = 5_000,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  reportFailure = (message) => console.error(message),
} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 6 ||
      !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 12_000 ||
      !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 5_000) throw Error('Invalid published inventory retry limits');
  const snapshot = parseSnapshot(expected);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const published = await fetchPropertySnapshot(snapshot, {
        fetcher: async (...args) => {
          const response = await (fetcher ?? fetch)(...args);
          if (!response.ok) throw new PublicFeedResponseError(response.status);
          return response;
        }, now: now(), timeoutMs,
      });
      if (!isDeepStrictEqual(published, snapshot)) throw Error('Published inventory differs from the verified Pages artifact');
      return { passed: true, checkedAt: published.checkedAt, propertyCount: published.properties.length, attempts: attempt };
    } catch (error) {
      // Do not log response bodies. Every retry must pass all client guards and
      // match the same artifact, never a mix of snapshots from different attempts.
      const failure = safeFailure(error);
      reportFailure(`Published inventory attempt ${attempt}/${attempts} failed: ${failure}`);
      if (attempt === attempts || error instanceof PublicFeedResponseError && !error.mayRetry) {
        throw Error(`Published inventory verification failed after ${attempt} attempt(s): ${failure}`);
      }
      await sleep(delayMs);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const expected = JSON.parse(readFileSync(resolve(process.argv[2] || 'web-build', 'properties.json'), 'utf8'));
    console.log(JSON.stringify(await verifyPublishedInventory(expected), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
