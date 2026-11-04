import type { Entry } from './types';
import type { AnyCategory, PaymentMode } from './constants';
import { daysInMonth, dayOfMonth } from './format';

/** Entries that count toward totals: parsed, saved, with a valid amount. */
export const counted = (e: Entry) =>
  e.amount != null && e.parseStatus !== 'failed' && e.sync !== 'pending' && e.sync !== 'error';

export const inMonth = (es: Entry[], m: string) =>
  es.filter((e) => counted(e) && e.spentOn.startsWith(m));

export function totals(es: Entry[]) {
  let spent = 0;
  let income = 0;
  for (const e of es) {
    if (e.type === 'income') {
      income += e.amount ?? 0;
    } else {
      spent += e.amount ?? 0;
    }
  }
  return { spent, income };
}

/** Daily spend in rupees up to `upto` day. */
export function byDay(es: Entry[], m: string, upto: number) {
  const n = Math.min(upto, daysInMonth(m));
  const arr = Array.from({ length: n }, (_, i) => ({ day: i + 1, amount: 0 }));
  for (const e of es) {
    if (e.type === 'expense') {
      const idx = dayOfMonth(e.spentOn) - 1;
      if (arr[idx]) {
        arr[idx].amount += (e.amount ?? 0) / 100;
      }
    }
  }
  return arr;
}

export function byCategory(es: Entry[]) {
  const map = new Map<AnyCategory, number>();
  for (const e of es) {
    if (e.type === 'expense') {
      map.set(e.category, (map.get(e.category) ?? 0) + (e.amount ?? 0));
    }
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([category, paise]) => ({
      category,
      paise,
      share: total ? paise / total : 0,
    }))
    .sort((a, b) => b.paise - a.paise);
}

export function byMode(es: Entry[]) {
  const map = new Map<PaymentMode, number>();
  for (const e of es) {
    if (e.type !== 'expense') continue;
    const k: PaymentMode = e.mode === 'unknown' ? 'other' : e.mode;
    map.set(k, (map.get(k) ?? 0) + (e.amount ?? 0));
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([mode, paise]) => ({
      mode,
      paise,
      share: total ? paise / total : 0,
    }))
    .sort((a, b) => b.paise - a.paise);
}

/** Running cumulative spend by day in rupees. */
export function cumulative(es: Entry[], m: string) {
  const n = daysInMonth(m);
  const per = Array(n).fill(0) as number[];
  for (const e of es) {
    if (e.type === 'expense') {
      per[dayOfMonth(e.spentOn) - 1] += (e.amount ?? 0) / 100;
    }
  }
  let run = 0;
  return per.map((v) => (run += v));
}

