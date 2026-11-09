import type { AnyCategory, EntryType, ParseStatus, PaymentMode, Source } from './constants';

export type { AnyCategory, EntryType, ParseStatus, PaymentMode, Source };

export type SyncState = 'pending' | 'synced' | 'error';

export interface Entry {
  _id?: string;
  clientId: string;
  rawText: string;
  source: Source;
  amount: number | null; // integer in paise
  type: EntryType;
  category: AnyCategory;
  categoryHint?: string | null;
  mode: PaymentMode;
  note?: string | null;
  spentAt: string; // ISO date string
  spentOn: string; // YYYY-MM-DD (IST)
  parseStatus: ParseStatus;
  createdAt: string;
  // UI-only optimistic fields
  sync?: SyncState;
  errorKind?: 'network' | 'ratelimit' | 'server';
  errorMessage?: string;
  fresh?: boolean;
}

export type Filter =
  | { kind: 'all' }
  | { kind: 'expense' }
  | { kind: 'income' }
  | { kind: 'category'; category: AnyCategory };

export interface Settings {
  lang: 'hi-IN' | 'en-IN';
  autoSend: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info' | 'warn';
  message: string;
  action?: { label: string; run: () => void };
}

export type AuthOutcome = 'claimed' | 'logged_in' | 'created' | 'noop';

export interface UserProfile {
  userId: string;
  isGuest: boolean;
  email?: string;
  name?: string;
  picture?: string;
  googleClientId?: string;
  claimedAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoogleAuthResponse {
  success: boolean;
  user: UserProfile;
  outcome: AuthOutcome;
  mergedCount: number;
}
