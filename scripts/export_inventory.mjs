// Export public listing fields only. Existing workflow checks gate publication.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSnapshot } from '../src/properties.ts';

const propertyFields = ['id', 'listingType', 'status', 'address', 'title', 'city', 'state',
  'postalCode', 'locationIncomplete', 'description', 'sourceStatus', 'price', 'bedrooms',
  'bathrooms', 'squareFeet', 'imageUrl', 'detailsUrl'];
const pick = (source, fields) => Object.fromEntries(fields.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

export function publicPropertySnapshot(value) {
  const source = parseSnapshot(value);
  const properties = source.properties.map((property) => {
    const result = pick(property, propertyFields);
    if (property.listingAgent) result.listingAgent = pick(property.listingAgent, ['name', 'phone', 'sourceUrl', 'attribution', 'textEvidence']);
    if (property.images !== undefined) result.images = property.images.map((image) => pick(image, ['url', 'alt', 'sourceUrl']));
    if (property.statusOverride) result.statusOverride = {
      ...pick(property.statusOverride, ['fromStatus', 'status', 'confirmedOn']),
      // Retain correction provenance needed by clients, never internal notes.
      reason: 'Availability corrected by AM Investments.',
    };
    return result;
  });
  return parseSnapshot({
    ...pick(source, ['schemaVersion', 'checkedAt', 'sourceUrl', 'sourcePropertyCount', 'excludedNonSaleCount']),
    sourcePages: [...source.sourcePages], properties,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputDir = resolve(process.argv[2] || 'dist');
  if (!existsSync(resolve(outputDir, 'index.html'))) throw new Error('Build the web export before exporting inventory');
  const snapshot = publicPropertySnapshot(JSON.parse(readFileSync('src/data/properties.json', 'utf8')));
  const target = resolve(outputDir, 'properties.json');
  writeFileSync(`${target}.tmp`, JSON.stringify(snapshot) + '\n');
  renameSync(`${target}.tmp`, target);
  console.log(`Exported validated public inventory: ${snapshot.properties.length} properties checked ${snapshot.checkedAt}`);
}
