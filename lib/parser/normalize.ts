import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_INCOME_CATEGORY,
  EXPENSE_CATEGORIES,
  ExpenseCategory,
  INCOME_CATEGORIES,
  IncomeCategory,
  TIMEZONE,
} from '@/lib/constants';
import { ParsedItem, RawLLMItem } from './types';

/**
 * Format a Date object into YYYY-MM-DD string in IST timezone.
 */
export function getISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Output format is YYYY-MM-DD
}

/**
 * Normalizes a raw LLM extracted item into a verified, sanitized ParsedItem.
 */
export function normalizeParsedItem(
  raw: RawLLMItem,
  referenceNow: Date = new Date()
): ParsedItem {
  const todayISTStr = getISTDateString(referenceNow);

  // 1. Amount & Parse Status
  let amountPaise: number | null = null;
  let parseStatus: ParsedItem['parseStatus'] = 'ok';

  if (raw.amount !== null && raw.amount !== undefined && raw.amount > 0) {
    amountPaise = Math.round(raw.amount * 100); // Convert Rupees to integer Paise
  } else {
    parseStatus = 'failed';
  }

  // 2. Type
  const type = raw.type === 'income' ? 'income' : 'expense';

  // 3. Category reconciliation
  let category = (raw.category || '').toLowerCase().trim();
  let categoryHint = raw.categoryHint ? raw.categoryHint.trim().slice(0, 100) : null;

  if (type === 'expense') {
    const isKnownExpense = (EXPENSE_CATEGORIES as readonly string[]).includes(category);
    if (!isKnownExpense) {
      if (category && category !== 'other') {
        categoryHint = categoryHint || category;
      }
      category = DEFAULT_EXPENSE_CATEGORY;
    }
  } else {
    // type === 'income'
    const isKnownIncome = (INCOME_CATEGORIES as readonly string[]).includes(category);
    if (!isKnownIncome) {
      if (category && category !== 'other_income') {
        categoryHint = categoryHint || category;
      }
      category = DEFAULT_INCOME_CATEGORY;
    }
  }

  // 4. Date & Timezone (Asia/Kolkata) Resolution
  let spentOn = todayISTStr;
  let spentAt = new Date(referenceNow);

  if (raw.date && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    // Clamp future dates to today in IST
    if (raw.date > todayISTStr) {
      spentOn = todayISTStr;
      spentAt = new Date(referenceNow);
    } else if (raw.date === todayISTStr) {
      spentOn = todayISTStr;
      spentAt = new Date(referenceNow);
    } else {
      spentOn = raw.date;
      // Use 12:00 PM IST (noon) for past dates without explicit time: YYYY-MM-DDT12:00:00+05:30
      spentAt = new Date(`${raw.date}T12:00:00+05:30`);
      // If parsing resulted in Invalid Date, fall back to now
      if (isNaN(spentAt.getTime())) {
        spentOn = todayISTStr;
        spentAt = new Date(referenceNow);
      }
    }
  }

  // 5. Payment mode (defaults to 'cash' if unspecified or unknown)
  let mode = (raw.mode as ParsedItem['mode']) || 'cash';
  if (!mode || mode === 'unknown') {
    mode = 'cash';
  }

  // 6. Note
  const note = raw.note ? raw.note.trim().slice(0, 100) : null;

  return {
    amount: amountPaise,
    type,
    category,
    categoryHint,
    mode,
    note,
    spentAt,
    spentOn,
    parseStatus,
  };
}

