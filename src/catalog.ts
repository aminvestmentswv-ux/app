import source from './data/properties.json';
import { parseSnapshot } from './properties';

// The web uses its verified build snapshot. Native uses this snapshot as a
// fallback while checking the public feed. No website editor credentials.
export const propertySnapshot = parseSnapshot(source);
export const saleProperties = propertySnapshot.properties;
