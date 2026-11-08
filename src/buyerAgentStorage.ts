import type { BuyerAgentStorage } from './buyerAgentStore';
export const BUYER_AGENT_STORAGE_KEY = 'am-buyer-agent-v1';
// This fallback is selected by the web build; native uses the .native module.
// Access storage lazily so server-side/config reads do not require window.
export const buyerAgentStorage: BuyerAgentStorage = {
  read: async () => window.localStorage.getItem(BUYER_AGENT_STORAGE_KEY),
  write: async (value) => { window.localStorage.setItem(BUYER_AGENT_STORAGE_KEY, value); },
  remove: async () => { window.localStorage.removeItem(BUYER_AGENT_STORAGE_KEY); },
};
