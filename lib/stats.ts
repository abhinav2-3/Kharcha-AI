import type { Entry } from './types';
import type { AnyCategory, PaymentMode } from './constants';
import {
  addDays,
  dayLabel,
  dayOfMonth,
  daysInMonth,
  monthLabel,
  monthName,
  monthOf,
  todayIST,
} from './format';

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

export interface PeriodPoint {
  key: string;
  label: string;
  fullDate: string;
  amount: number;
  dayNumber?: number;
  isToday?: boolean;
  isCurrent?: boolean;
}

/** 7 days of the week containing refDate (Mon-Sun), with spend in rupees. */
export function byWeek(es: Entry[], refDate: string = todayIST()): PeriodPoint[] {
  const d = new Date(`${refDate.slice(0, 10)}T00:00:00Z`);
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const distToMon = (dayOfWeek + 6) % 7;
  const mondayStr = addDays(refDate.slice(0, 10), -distToMon);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = todayIST();

  const points: PeriodPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const curDateStr = addDays(mondayStr, i);
    let amount = 0;
    for (const e of es) {
      if (e.type === 'expense' && counted(e) && e.spentOn === curDateStr) {
        amount += (e.amount ?? 0) / 100;
      }
    }
    points.push({
      key: curDateStr,
      label: dayNames[i],
      fullDate: dayLabel(curDateStr),
      amount,
      dayNumber: dayOfMonth(curDateStr),
      isToday: curDateStr === today,
      isCurrent: curDateStr === today,
    });
  }
  return points;
}

/** Daily spend in rupees for all days in month `m` up to `upto`. */
export function byMonth(es: Entry[], m: string, upto?: number): (PeriodPoint & { day: number })[] {
  const n = upto ?? daysInMonth(m);
  const today = todayIST();
  const points: (PeriodPoint & { day: number })[] = [];

  for (let i = 1; i <= n; i++) {
    const dayStr = `${m}-${String(i).padStart(2, '0')}`;
    let amount = 0;
    for (const e of es) {
      if (e.type === 'expense' && counted(e) && e.spentOn === dayStr) {
        amount += (e.amount ?? 0) / 100;
      }
    }
    points.push({
      key: dayStr,
      day: i,
      label: String(i),
      fullDate: dayLabel(dayStr),
      amount,
      dayNumber: i,
      isToday: dayStr === today,
      isCurrent: dayStr === today,
    });
  }
  return points;
}

/** 3 months of the calendar quarter containing `ref` (YYYY-MM or YYYY-MM-DD), with spend in rupees. */
export function byQuarter(es: Entry[], ref: string = todayIST()): PeriodPoint[] {
  const [yStr, moStr] = ref.slice(0, 7).split('-');
  const y = Number(yStr);
  const mo = Number(moStr);
  const q = Math.floor((mo - 1) / 3) + 1;
  const startMonth = (q - 1) * 3 + 1;
  const curMonth = monthOf(todayIST());

  const points: PeriodPoint[] = [];
  for (let k = 0; k < 3; k++) {
    const mNum = startMonth + k;
    const mStr = `${y}-${String(mNum).padStart(2, '0')}`;
    let amount = 0;
    for (const e of es) {
      if (e.type === 'expense' && counted(e) && e.spentOn.startsWith(mStr)) {
        amount += (e.amount ?? 0) / 100;
      }
    }
    points.push({
      key: mStr,
      label: monthName(mStr).slice(0, 3),
      fullDate: monthLabel(mStr),
      amount,
      isToday: mStr === curMonth,
      isCurrent: mStr === curMonth,
    });
  }
  return points;
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

