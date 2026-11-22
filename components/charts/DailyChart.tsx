'use client';
import { useState, useMemo, useEffect } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compact, monthName, monthOf, rupees, todayIST } from '@/lib/format';
import { byWeek, byMonth, byQuarter, type PeriodPoint } from '@/lib/stats';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';
import DataTable from './DataTable';

type Period = 'week' | 'month' | 'quarter';

interface DailyChartProps {
  data?: { day: number; amount: number }[];
  month: string;
  entries?: Entry[];
}

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: PeriodPoint = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-ink px-3 py-2 text-[12.5px] text-bg shadow-xl">
      <p className="opacity-75">{p.fullDate}</p>
      <p className="num text-[14px] font-semibold text-bg">
        {rupees(Math.round(p.amount * 100))}
      </p>
    </div>
  );
}

export default function DailyChart({ data: legacyData, month, entries: propEntries }: DailyChartProps) {
  const { entries: storeEntries } = useStore();
  const entries = propEntries ?? storeEntries;

  const [period, setPeriod] = useState<Period>('week');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const today = todayIST();
  const isCurrentMonth = month === monthOf(today);

  // Compute period data points
  const points: PeriodPoint[] = useMemo(() => {
    if (!entries || entries.length === 0) {
      if (legacyData && period === 'month') {
        return legacyData.map((d) => ({
          key: `${month}-${String(d.day).padStart(2, '0')}`,
          label: String(d.day),
          fullDate: `${d.day} ${monthName(month)}`,
          amount: d.amount,
          dayNumber: d.day,
        }));
      }
    }

    if (period === 'week') {
      const refDate = isCurrentMonth ? today : `${month}-01`;
      return byWeek(entries || [], refDate);
    }
    if (period === 'quarter') {
      return byQuarter(entries || [], month);
    }
    // month
    return byMonth(entries || [], month);
  }, [entries, legacyData, month, period, isCurrentMonth, today]);

  const max = Math.max(...points.map((p) => p.amount), 0);
  const maxIdx = points.findIndex((p) => p.amount === max);
  const total = points.reduce((acc, p) => acc + p.amount, 0);

  const activePoint = points.find((p) => p.key === selectedKey) || null;

  // Max bar size based on period
  const maxBarSize = period === 'quarter' ? 44 : period === 'week' ? 24 : 10;

  // Month-specific ticks to avoid overlapping on mobile
  const monthTicks = period === 'month' ? [1, 8, 15, 22, 29].filter((t) => t <= points.length) : undefined;

  return (
    <div className="select-none">
      {/* Period Selector & Active Inspection Bar */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-tint p-0.5 border border-line">
          {(['week', 'month', 'quarter'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setSelectedKey(null);
              }}
              className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-all ${
                period === p
                  ? 'bg-ink text-bg font-semibold shadow-xs'
                  : 'text-ink2 hover:text-ink'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="text-right">
          {activePoint ? (
            <div>
              <span className="text-[11px] font-medium text-ink2 block">{activePoint.fullDate}</span>
              <span className="num text-[13.5px] font-bold text-ink">
                {rupees(Math.round(activePoint.amount * 100))}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-[11px] font-medium text-ink2 block">
                {period === 'week' ? 'This Week' : period === 'month' ? monthName(month) : 'This Quarter'}
              </span>
              <span className="num text-[13.5px] font-semibold text-ink">
                {rupees(Math.round(total * 100))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        role="img"
        aria-label={`${period} spending. Total: ${rupees(Math.round(total * 100))}.`}
        className="touch-manipulation"
      >
        {mounted ? (
          <ResponsiveContainer width="100%" height={175}>
            <BarChart
              data={points}
              margin={{ top: 22, right: 4, left: -14, bottom: 0 }}
              barCategoryGap={period === 'month' ? '14%' : '20%'}
              onClick={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const clicked: PeriodPoint = state.activePayload[0].payload;
                  setSelectedKey((prev) => (prev === clicked.key ? null : clicked.key));
                }
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey={period === 'month' ? 'day' : 'label'}
                ticks={monthTicks}
                tickLine={false}
                axisLine={{ stroke: 'var(--axis)' }}
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                interval={0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={38}
                tickCount={3}
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                tickFormatter={(v) => (v === 0 ? '0' : compact(v))}
              />
              <Tooltip
                cursor={{ fill: 'var(--tint)' }}
                content={<Tip />}
              />
              <Bar
                dataKey="amount"
                radius={[4, 4, 0, 0]}
                maxBarSize={maxBarSize}
                isAnimationActive={false}
                label={(p: any) => {
                  const pt = points[p.index];
                  if (!pt || pt.amount <= 0) return <g />;
                  const isSelected = pt.key === selectedKey;
                  const isPeak = p.index === maxIdx;
                  // On week or quarter, display amount on all non-zero bars
                  // On month, display on selected bar, peak, or today
                  const shouldShow =
                    period !== 'month' || isSelected || isPeak || pt.isToday;

                  if (!shouldShow) return <g />;

                  return (
                    <text
                      x={p.x + p.width / 2}
                      y={p.y - 6}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={isSelected || isPeak ? 600 : 500}
                      fill="var(--ink)"
                    >
                      {compact(pt.amount)}
                    </text>
                  );
                }}
              >
                {points.map((p) => {
                  const isSelected = p.key === selectedKey;
                  const hasSelection = activePoint !== null;
                  let opacity = 0.8;
                  if (hasSelection) {
                    opacity = isSelected ? 1 : 0.35;
                  } else if (p.isToday || p.isCurrent) {
                    opacity = 1;
                  }

                  return (
                    <Cell
                      key={p.key}
                      fill="var(--ink)"
                      fillOpacity={opacity}
                      className="cursor-pointer transition-opacity"
                      onClick={() => setSelectedKey((prev) => (prev === p.key ? null : p.key))}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[175px] w-full skel rounded-xl animate-pulse" />
        )}
      </div>

      <DataTable
        caption={`${period} spending breakdown`}
        head={[period === 'month' ? 'Day' : 'Period', 'Spent']}
        rows={points
          .filter((d) => d.amount > 0)
          .map((d) => [d.fullDate, rupees(Math.round(d.amount * 100))])}
      />
    </div>
  );
}
