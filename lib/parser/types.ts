import { EntryType, ParseStatus, PaymentMode } from '@/lib/constants';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Universal interface for LLM providers (Groq, Gemini, OpenAI, etc.)
 */
export interface LLMProvider {
  name: string;
  generateJSON(messages: LLMMessage[], options?: { timeoutMs?: number }): Promise<string>;
}

export interface RawLLMItem {
  amount: number | null;
  type?: string;
  category?: string;
  categoryHint?: string | null;
  mode?: string;
  note?: string | null;
  date?: string | null; // YYYY-MM-DD
}

export interface RawLLMResponse {
  entries: RawLLMItem[];
}

export interface ParsedItem {
  amount: number | null; // Integer in paise, null if parse failed
  type: EntryType;
  category: string;
  categoryHint: string | null;
  mode: PaymentMode;
  note: string | null;
  spentAt: Date;
  spentOn: string; // YYYY-MM-DD (IST)
  parseStatus: ParseStatus;
}

