// Materialize the owner-approved PNG from its lossless, text-stored source.
import { readFileSync, writeFileSync } from 'node:fs';
const source = new URL('../assets/am-investments-logo-house.png.base64', import.meta.url);
const target = new URL('../assets/am-investments-logo-house.png', import.meta.url);
const png = Buffer.from(readFileSync(source, 'utf8'), 'base64');
if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid approved logo PNG');
writeFileSync(target, png);
