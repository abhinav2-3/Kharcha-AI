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
  shiftMonth,
  todayIST,
} from './format';

/** Entries that count toward totals: parsed, saved, with a valid amount. */
export const counted = (e: Entry) =>
  e.amount != null && e.parseStatus !== 'failed' && e.sync !== 'error';

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

export type TrajectoryPeriod = 'week' | 'month' | 'quarter' | 'half_year' | 'full_year';

export function getTrajectoryData(
  es: Entry[],
  period: TrajectoryPeriod,
  currentMonth: string = monthOf(todayIST())
): PeriodPoint[] {
  const today = todayIST();
  const isCurMonth = currentMonth === monthOf(today);

  if (period === 'week') {
    const ref = isCurMonth ? today : `${currentMonth}-01`;
    return byWeek(es, ref);
  }

  if (period === 'month') {
    const n = daysInMonth(currentMonth);
    const mName = monthName(currentMonth).slice(0, 3);
    const buckets = [
      { key: `${currentMonth}-w1`, label: 'wk 1', fullDate: `1-7 ${mName}`, start: 1, end: 7 },
      { key: `${currentMonth}-w2`, label: 'wk 2', fullDate: `8-14 ${mName}`, start: 8, end: 14 },
      { key: `${currentMonth}-w3`, label: 'wk 3', fullDate: `15-21 ${mName}`, start: 15, end: 21 },
      { key: `${currentMonth}-w4`, label: 'wk 4', fullDate: `22-${n} ${mName}`, start: 22, end: n },
    ];

    const curDay = dayOfMonth(today);
    return buckets.map((b) => {
      let amount = 0;
      for (const e of es) {
        if (e.type === 'expense' && counted(e) && e.spentOn.startsWith(currentMonth)) {
          const d = dayOfMonth(e.spentOn);
          if (d >= b.start && d <= b.end) {
            amount += (e.amount ?? 0) / 100;
          }
        }
      }
      const isCurrent = isCurMonth && curDay >= b.start && curDay <= b.end;
      return {
        key: b.key,
        label: b.label,
        fullDate: b.fullDate,
        amount,
        isCurrent,
        isToday: isCurrent,
      };
    });
  }

  if (period === 'quarter') {
    return byQuarter(es, currentMonth);
  }

  if (period === 'half_year') {
    const months = [
      shiftMonth(currentMonth, -5),
      shiftMonth(currentMonth, -4),
      shiftMonth(currentMonth, -3),
      shiftMonth(currentMonth, -2),
      shiftMonth(currentMonth, -1),
      currentMonth,
    ];
    return months.map((m) => {
      let amount = 0;
      for (const e of es) {
        if (e.type === 'expense' && counted(e) && e.spentOn.startsWith(m)) {
          amount += (e.amount ?? 0) / 100;
        }
      }
      return {
        key: m,
        label: monthName(m).slice(0, 3).toLowerCase(),
        fullDate: monthLabel(m),
        amount,
        isCurrent: m === currentMonth,
        isToday: m === monthOf(today),
      };
    });
  }

  // full_year (12 months of the calendar year of currentMonth)
  const [yearStr] = currentMonth.split('-');
  const y = Number(yearStr);
  const curMonth = monthOf(today);
  const points: PeriodPoint[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    const mStr = `${y}-${String(mo).padStart(2, '0')}`;
    let amount = 0;
    for (const e of es) {
      if (e.type === 'expense' && counted(e) && e.spentOn.startsWith(mStr)) {
        amount += (e.amount ?? 0) / 100;
      }
    }
    points.push({
      key: mStr,
      label: monthName(mStr).slice(0, 3).toLowerCase(),
      fullDate: monthLabel(mStr),
      amount,
      isCurrent: mStr === currentMonth,
      isToday: mStr === curMonth,
    });
  }
  return points;
}

