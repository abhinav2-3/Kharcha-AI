'use client';
import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { byCategory, byDay, inMonth, totals } from '@/lib/stats';
import {
  dayOfMonth,
  daysInMonth,
  monthName,
  monthOf,
  rupees,
  shiftMonth,
  todayIST,
} from '@/lib/format';
import { useCountUp } from '@/lib/hooks';
import MonthSwitcher from '@/components/MonthSwitcher';
import Section from '@/components/Section';
import EntryRow from '@/components/EntryRow';
import DailyChart from '@/components/charts/DailyChart';
import CategoryBars from '@/components/charts/CategoryBars';

const ENGLISH_QUICK_CHIPS = [
  '500 for coffee with cash',
  '300 for fuel via UPI',
  '20 for tea and 30 for snacks',
  'Salary credited 45000',
  '1200 electricity bill via card',
];

export default function HomePage() {
  const { entries, sorted, loaded, month, setDraft } = useStore();
  const today = todayIST();
  const isCurrent = month === monthOf(today);
  const upto = isCurrent ? dayOfMonth(today) : daysInMonth(month);
  const prevMonth = shiftMonth(month, -1);

  const m = useMemo(() => inMonth(entries, month), [entries, month]);
  const { spent, income } = totals(m);

  const prevSoFar = useMemo(
    () =>
      totals(
        inMonth(entries, prevMonth).filter((e) => dayOfMonth(e.spentOn) <= upto)
      ).spent,
    [entries, prevMonth, upto]
  );

  const hasPrev = prevSoFar > 0;
  const delta = spent - prevSoFar;
  const daily = useMemo(() => byDay(m, month, upto), [m, month, upto]);
  const cats = useMemo(() => byCategory(m), [m]);
  const hero = useCountUp(spent);
  const avg = upto ? Math.round(spent / upto / 100) * 100 : 0;

  // Entries requiring immediate attention (pending, failed/missing amount, or just added)
  const attention = sorted.filter(
    (e) => e.sync !== 'synced' || e.parseStatus === 'failed' || e.amount == null || e.fresh
  );
  const hasPending = attention.some((e) => e.sync === 'pending');
  const needsFix = attention.some(
    (e) => e.sync === 'error' || e.parseStatus === 'failed' || e.amount == null
  );
  const attentionTitle = hasPending
    ? 'Adding...'
    : needsFix
    ? 'Needs Attention'
    : 'Just Added';

  const recent = sorted.filter((e) => !attention.includes(e)).slice(0, 6);
  const currentMonthName = monthName(month);
  const isEmpty = loaded && entries.length === 0;

  return (
    <div>
      {/* Brand Hero Header */}
      <section className="rounded-b-[28px] bg-brand px-5 pb-6 pt-[calc(env(safe-area-inset-top)+14px)] text-on-brand shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-[18px] font-bold tracking-tight">Kharcha</span>
          <MonthSwitcher onBrand />
        </div>

        <p className="mt-7 text-[15px] text-on-brand2 font-medium">
          Spent in {currentMonthName}
        </p>

        {loaded ? (
          <p
            className="num mt-1 text-[54px] font-bold leading-[1.05] tracking-[-0.035em]"
            aria-live="polite"
          >
            {rupees(Math.round(hero))}
          </p>
        ) : (
          <div className="skel mt-2 h-[58px] w-56 !bg-white/15" />
        )}

        <div className="mt-2 min-h-[28px]">
          {loaded && hasPrev && (
            <span
              className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[13px] font-medium ${
                delta <= 0 ? 'text-good-on-brand' : 'text-bad-on-brand'
              }`}
            >
              {delta <= 0 ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
              {rupees(Math.abs(delta))} {delta <= 0 ? 'less' : 'more'} than {monthName(prevMonth)}{' '}
              {isCurrent ? 'so far' : ''}
            </span>
          )}
        </div>

        {/* Income & Balance Summary */}
        <dl className="mt-6 grid grid-cols-2 border-t border-white/15 pt-4">
          <div>
            <dt className="text-[13px] text-on-brand2 font-medium">Income</dt>
            <dd className="num mt-0.5 text-[18px] font-semibold">
              {loaded ? rupees(income) : '—'}
            </dd>
          </div>
          <div className="border-l border-white/15 pl-5">
            <dt className="text-[13px] text-on-brand2 font-medium">Remaining Balance</dt>
            <dd className="num mt-0.5 text-[18px] font-semibold">
              {loaded
                ? `${income - spent < 0 ? '-' : ''}${rupees(Math.abs(income - spent))}`
                : '—'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Content Area */}
      {!loaded ? (
        <div className="mt-7 space-y-4 px-5" aria-label="Loading content">
          <div className="skel h-5 w-36" />
          <div className="skel h-40 w-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel h-12 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <section className="px-5 pt-9">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink shadow-sm">
            <Sparkles size={22} />
          </span>
          <h2 className="mt-4 text-[22px] font-bold leading-tight text-ink">
            Log your first expense
          </h2>
          <p className="mt-2 max-w-[320px] text-[15px] leading-relaxed text-ink2">
            Type below or tap the microphone. Amount, category, and payment mode will be
            extracted automatically.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {ENGLISH_QUICK_CHIPS.map((chipText) => (
              <button
                key={chipText}
                onClick={() => setDraft(chipText)}
                className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-medium text-ink hover:bg-tint transition-colors active:scale-95"
              >
                {chipText}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          {/* Attention drawer */}
          {attention.length > 0 && (
            <Section title={attentionTitle} pad={false}>
              <ul className="divide-y divide-line bg-surface shadow-sm rounded-2xl mx-5 overflow-hidden">
                {attention.map((e) => (
                  <li key={e.clientId}>
                    <EntryRow entry={e} showDay />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Daily spending chart */}
          <Section
            title="Daily Spending"
            aside={spent > 0 ? `Avg ${rupees(avg)} a day` : undefined}
          >
            {spent > 0 ? (
              <DailyChart data={daily} month={month} />
            ) : (
              <p className="rounded-2xl bg-tint px-4 py-6 text-center text-[15px] text-ink2">
                No spending logged in {currentMonthName}.
              </p>
            )}
          </Section>

          {/* Top categories breakdown */}
          {cats.length > 0 && (
            <Section title="Top Categories" href="/insights" pad={false}>
              <CategoryBars rows={cats} limit={4} />
            </Section>
          )}

          {/* Recent list */}
          <Section title="Recent Activity" href="/history" pad={false}>
            <ul className="divide-y divide-line/70">
              {recent.map((e) => (
                <li key={e.clientId}>
                  <EntryRow entry={e} showDay />
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
