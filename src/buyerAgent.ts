import type { SaleProperty } from './properties';
import { shareContent } from './sharing.ts';

export type BuyerAgent = { name: string; phone: string };

// This WV browsing app accepts explicitly entered US/Canada numbers only.
// Formatting validation does not establish ownership or whether a line supports SMS.
export function parseBuyerAgent(name: string, input: string): BuyerAgent {
  if (!/^\+?[\d\s().-]+$/.test(input) || input.trim().length > 30) {
    throw new Error('Enter a US or Canada phone number, without an extension.');
  }
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    throw new Error('Enter a valid 10-digit US or Canada phone number.');
  }
  const cleanName = name.trim();
  if (cleanName.length > 80 || /[\u0000-\u001f\u007f]/.test(cleanName)) throw new Error('Use an agent name of 80 characters or fewer.');
  return { name: cleanName, phone: `+1${digits}` };
}

export function buyerAgentLink(agent: BuyerAgent, action: 'call' | 'text', property: SaleProperty, apple = false): string {
  const verified = parseBuyerAgent(agent.name, agent.phone);
  if (action === 'call') return `tel:${verified.phone}`;
  const content = shareContent(property);
  const message = `${content.text}\n${content.url}`;
  return `sms:${verified.phone}${apple ? '&' : '?'}body=${encodeURIComponent(message)}`;
}
