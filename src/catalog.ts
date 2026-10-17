import source from './data/properties.json';
import { parseSnapshot } from './properties';

// A dated, bundled inventory works on native and web without assuming CORS or
// exposing a website editor credential. Refresh using npm run sync:properties.
export const propertySnapshot = parseSnapshot(source);
export const saleProperties = propertySnapshot.properties;
