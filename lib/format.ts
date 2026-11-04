const TZ = 'Asia/Kolkata';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

export const todayIST = (d = new Date()) => dayFmt.format(d);
export const monthOf = (day: string) => day.slice(0, 7);
export const dayOfMonth = (day: string) => Number(day.slice(8, 10));

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysInMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};

export const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};

export const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });

export const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const dayLabel = (day: string) => {
  const today = todayIST();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
};

export const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export const timeLabel = (iso: string) =>
  new Date(iso)
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ })
    .toLowerCase();

/** paise -> "₹11,23,456" (decimals only when paise has fractions of a rupee) */
export const rupees = (paise: number) => {
  const r = paise / 100;
  const whole = Number.isInteger(r);
  return `₹${r.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

/** rupees -> "1.2K" / "3.4L" for chart axes */
export const compact = (r: number) => {
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  if (r >= 10_000_000) return `${trim(r / 10_000_000)}Cr`;
  if (r >= 100_000) return `${trim(r / 100_000)}L`;
  if (r >= 1_000) return `${trim(r / 1_000)}K`;
  return String(Math.round(r));
};

export const parseAmountInput = (s: string): number | null => {
  const n = Number(s.replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) && s.trim() !== '' ? n : null;
};

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

