'use client';
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { byCategory, byMode, cumulative, inMonth, totals } from '@/lib/stats';
import { daysInMonth, monthName, rupees, shiftMonth } from '@/lib/format';
import MonthSwitcher from '@/components/MonthSwitcher';
import Section from '@/components/Section';
import CategoryBars from '@/components/charts/CategoryBars';
import ModeBar from '@/components/charts/ModeBar';
import TrendChart from '@/components/charts/TrendChart';

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

  const trendData = useMemo(() => {
    const curCum = cumulative(mCurrent, month);
    const prevCum = cumulative(mPrev, prevMonth);
    const days = Math.max(daysInMonth(month), daysInMonth(prevMonth));

    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      cur: i < curCum.length ? curCum[i] : null,
      prev: i < prevCum.length ? prevCum[i] : null,
    }));
  }, [mCurrent, mPrev, month, prevMonth]);

  const currentMonthName = monthName(month);

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
          {/* Monthly Comparison Trend */}
          <Section
            title="Spending Pace"
            aside={curSpent > 0 ? `Total: ${rupees(curSpent)}` : undefined}
          >
            <TrendChart data={trendData} month={month} prevMonth={prevMonth} />
          </Section>

          {/* Category Breakdown */}
          {cats.length > 0 && (
            <Section title="Spending by Category" pad={false}>
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

