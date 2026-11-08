import { File, Paths } from 'expo-file-system';
import { createBuyerAgentFileStorage } from './buyerAgentFileStorage';

// App-private files only. No contact permissions, network requests, or user paths.
// OS backups may include app documents; the UI and release notes disclose this.
export const buyerAgentStorage = createBuyerAgentFileStorage({
  slots: () => [
    new File(Paths.document, 'am-buyer-agent-v1-a.json'),
    new File(Paths.document, 'am-buyer-agent-v1-b.json'),
  ],
});
