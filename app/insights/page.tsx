'use client';
import { useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { byCategory, byMode, inMonth, totals } from '@/lib/stats';
import { monthLabel, monthName, rupees, shiftMonth } from '@/lib/format';
import dynamic from 'next/dynamic';
import MonthSwitcher from '@/components/MonthSwitcher';
import Section from '@/components/Section';
import CategoryBars from '@/components/charts/CategoryBars';
import ModeBar from '@/components/charts/ModeBar';

const WaveChart = dynamic(() => import('@/components/charts/WaveChart'), {
  ssr: false,
  loading: () => <div className="h-44 w-full skel rounded-2xl animate-pulse" />,
});

export default function InsightsPage() {
  const { entries, loaded, month, serverStats } = useStore();
  const prevMonth = shiftMonth(month, -1);

  const mCurrent = useMemo(() => inMonth(entries, month), [entries, month]);
  const mPrev = useMemo(() => inMonth(entries, prevMonth), [entries, prevMonth]);

  const { spent: localCurSpent } = totals(mCurrent);
  const { spent: prevSpent } = totals(mPrev);

  // Reconcile with server stats if server has more historical entries for this month
  const isServerMonth = serverStats?.range?.from?.startsWith(month);
  const serverHasMore = isServerMonth && (serverStats?.totals?.transactionCount ?? 0) > mCurrent.length;
  const curSpent = serverHasMore ? serverStats.totals.expense.paise : localCurSpent;

  const localCats = useMemo(() => byCategory(mCurrent), [mCurrent]);
  const cats = useMemo(() => {
    if (serverHasMore && serverStats?.byCategory?.length > 0) {
      const expenseCats = serverStats.byCategory.filter((c: any) => c.type === 'expense');
      const total = serverStats.totals?.expense?.paise || 1;
      return expenseCats.map((c: any) => ({
        category: c.category,
        paise: c.totalPaise,
        share: c.totalPaise / total,
      }));
    }
    return localCats;
  }, [serverHasMore, serverStats, localCats]);

  const modes = useMemo(() => byMode(mCurrent), [mCurrent]);

  const waveData = useMemo(() => {
    // 6-month trailing window ending at active `month`
    const months = [
      shiftMonth(month, -5),
      shiftMonth(month, -4),
      shiftMonth(month, -3),
      shiftMonth(month, -2),
      shiftMonth(month, -1),
      month,
    ];

    return months.map((m) => {
      const mEntries = inMonth(entries, m);
      const isCur = m === month;
      const amountPaise = isCur && serverHasMore ? curSpent : totals(mEntries).spent;

      return {
        key: m,
        label: monthName(m).slice(0, 3).toLowerCase(),
        fullDate: monthLabel(m),
        amount: amountPaise / 100,
        isCurrent: isCur,
      };
    });
  }, [entries, month, curSpent, serverHasMore]);

  const currentMonthName = monthName(month);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#spending-by-category') {
      const el = document.getElementById('spending-by-category');
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
    }
  }, [loaded, cats.length]);

  return (
    <div className="pb-8">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">Insights</h1>
        <MonthSwitcher />
      </header>

      {!loaded ? (
        <div className="mt-4 space-y-4 px-5">
          <div className="skel h-48 w-full" />
          <div className="skel h-36 w-full" />
        </div>
      ) : curSpent === 0 && prevSpent === 0 ? (
        <div className="px-5 pt-16 text-center">
          <p className="text-[18px] font-semibold text-ink">No data for {currentMonthName}</p>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[15px] text-ink2">
            Log your daily expenses to see category breakdowns and monthly trends.
          </p>
        </div>
      ) : (
        <>
          {/* Fluid Monochrome Spending Wave */}
          <Section title="Spending Trajectory">
            <WaveChart currentMonth={month} entries={entries} />
          </Section>

          {/* Category Breakdown */}
          {cats.length > 0 && (
            <Section id="spending-by-category" title="Spending by Category" aside="Tap to view history" pad={false}>
              <CategoryBars rows={cats} />
            </Section>
          )}

          {/* Payment Mode Distribution */}
          {modes.length > 0 && (
            <Section title="Payment Modes">
              <ModeBar rows={modes} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

