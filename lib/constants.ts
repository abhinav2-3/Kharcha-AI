export const ENTRY_TYPES = ['expense', 'income'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  'food',
  'groceries',
  'transport',
  'fuel',
  'travel',
  'bills',
  'rent',
  'shopping',
  'health',
  'education',
  'entertainment',
  'personal_care',
  'gifts',
  'emi_loans',
  'investment',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const INCOME_CATEGORIES = [
  'salary',
  'business',
  'freelance',
  'refund',
  'gift_received',
  'other_income',
] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] as const;
export type AnyCategory = (typeof ALL_CATEGORIES)[number];

export const PAYMENT_MODES = [
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'other',
  'unknown',
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SOURCES = ['text', 'voice'] as const;
export type Source = (typeof SOURCES)[number];

export const PARSE_STATUS = ['ok', 'failed', 'manual'] as const;
export type ParseStatus = (typeof PARSE_STATUS)[number];

export const DEFAULT_ENTRY_TYPE: EntryType = 'expense';
export const DEFAULT_EXPENSE_CATEGORY: ExpenseCategory = 'other';
export const DEFAULT_INCOME_CATEGORY: IncomeCategory = 'other_income';
export const DEFAULT_PAYMENT_MODE: PaymentMode = 'cash';

export const COOKIE_NAME = 'kharcha_guest_token';
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year
export const TIMEZONE = 'Asia/Kolkata'; // Fixed IST for v1

