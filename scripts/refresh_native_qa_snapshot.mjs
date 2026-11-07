/** Read the existing public feed for disposable test builds. Never publish data. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fetchPropertySnapshot } from '../src/inventoryFeed.ts';
import { parseSnapshot } from '../src/properties.ts';
const bundled = parseSnapshot(JSON.parse(fs.readFileSync('src/data/properties.json', 'utf8')));
const published = await fetchPropertySnapshot(bundled);
const serialized = JSON.stringify(published, null, 2) + '\n';
fs.mkdirSync('test-results', { recursive: true });
fs.writeFileSync('src/data/properties.json', serialized);
fs.writeFileSync('test-results/native-live-snapshot.json', serialized);
const metadata = {
  checkedAt: published.checkedAt,
  snapshotSha256: createHash('sha256').update(serialized).digest('hex'),
  counts: Object.fromEntries(['available', 'coming-soon', 'under-contract', 'sold'].map((status) => [status, published.properties.filter((p) => p.status === status).length])),
  scope: 'Existing public feed in disposable test build only; no inventory publication or production deployment',
};
fs.writeFileSync('test-results/native-inventory-metadata.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
