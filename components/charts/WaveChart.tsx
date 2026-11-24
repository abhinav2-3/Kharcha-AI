'use client';
import { useState, useMemo } from 'react';
import { compact, monthLabel, monthName, rupees, todayIST, monthOf } from '@/lib/format';
import { getTrajectoryData, type TrajectoryPeriod, type PeriodPoint } from '@/lib/stats';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';
import DataTable from './DataTable';

interface WaveChartProps {
  data?: PeriodPoint[];
  currentMonth: string;
  entries?: Entry[];
}

const PERIOD_LABELS: Record<TrajectoryPeriod, { button: string; avgLabel: string; totalLabel: string }> = {
  week: { button: 'Week', avgLabel: 'Daily Avg', totalLabel: 'This Week' },
  month: { button: 'Month', avgLabel: 'Weekly Avg', totalLabel: 'This Month' },
  quarter: { button: 'Quarter', avgLabel: 'Monthly Avg', totalLabel: 'This Quarter' },
  half_year: { button: 'Half Year', avgLabel: '6-Mo Avg', totalLabel: '6-Month Total' },
  full_year: { button: 'Full Year', avgLabel: 'Monthly Avg', totalLabel: 'Annual Total' },
};

function getSplinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function WaveChart({ data: propData, currentMonth, entries: propEntries }: WaveChartProps) {
  const { entries: storeEntries } = useStore();
  const entries = propEntries ?? storeEntries;

  const [period, setPeriod] = useState<TrajectoryPeriod>('half_year');

  // Compute period data points
  const data: PeriodPoint[] = useMemo(() => {
    if (!entries || entries.length === 0) {
      if (propData && propData.length > 0) return propData;
    }
    return getTrajectoryData(entries || [], period, currentMonth);
  }, [entries, period, currentMonth, propData]);

  // Find index of current month/point in data, default to last active point
  const defaultIdx = useMemo(() => {
    const found = data.findIndex((d) => d.isCurrent || d.key === currentMonth);
    return found !== -1 ? found : Math.max(0, data.length - 1);
  }, [data, currentMonth]);

  const [activeIdx, setActiveIdx] = useState<number>(defaultIdx);

  // Update activeIdx when period changes if out of bounds
  const safeActiveIdx = activeIdx >= 0 && activeIdx < data.length ? activeIdx : defaultIdx;
  const activePoint = data[safeActiveIdx] ?? data[data.length - 1];

  const max = Math.max(...data.map((d) => d.amount), 0);
  const total = data.reduce((acc, d) => acc + d.amount, 0);
  const avg = data.length > 0 ? Math.round(total / data.length) : 0;

  // ViewBox geometry
  const width = 480;
  const height = 165;
  const padX = data.length > 7 ? 24 : 36;
  const padTop = 26;
  const padBottom = 48;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;

  // Map data to SVG coordinates
  const points = useMemo(() => {
    const n = data.length;
    if (n === 0) return [];
    const step = n > 1 ? plotWidth / (n - 1) : 0;

    return data.map((d, i) => {
      const x = padX + i * step;
      let y: number;

      if (max <= 0) {
        // Aesthetic harmonic wave if zero spend
        y = padTop + plotHeight * 0.5 + Math.sin(i * 1.2) * 14;
      } else {
        const ratio = d.amount / max;
        // Invert Y so higher amount is closer to top
        y = padTop + plotHeight - ratio * plotHeight;
      }

      return { x, y, data: d };
    });
  }, [data, max, plotWidth, plotHeight, padX, padTop]);

  const splinePath = useMemo(() => {
    return getSplinePath(points.map((p) => ({ x: p.x, y: p.y })));
  }, [points]);

  // Closed area path for subtle gradient under curve
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = padTop + plotHeight + 10;
    return `${splinePath} L ${last.x.toFixed(2)},${bottomY} L ${first.x.toFixed(2)},${bottomY} Z`;
  }, [splinePath, points, padTop, plotHeight]);

  // Difference vs average
  const diffAvg = activePoint && avg > 0 ? Math.round(((activePoint.amount - avg) / avg) * 100) : 0;
  const periodMeta = PERIOD_LABELS[period];

  return (
    <div className="select-none outline-none focus:outline-none">
      {/* Time Period Selector */}
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-tint p-0.5 border border-line overflow-x-auto no-scrollbar max-w-full">
          {(['week', 'month', 'quarter', 'half_year', 'full_year'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setActiveIdx(-1);
              }}
              className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition-all outline-none focus:outline-none ${
                period === p
                  ? 'bg-ink text-bg font-semibold shadow-xs'
                  : 'text-ink2 hover:text-ink'
              }`}
            >
              {PERIOD_LABELS[p].button}
            </button>
          ))}
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10.5px] font-medium text-ink2 block">{periodMeta.avgLabel}</span>
          <span className="num text-[12.5px] font-semibold text-ink2">
            {rupees(Math.round(avg * 100))}
          </span>
        </div>
      </div>

      {/* Active Point Display */}
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <div>
          <span className="text-[12px] font-medium text-ink2 block capitalize">
            {activePoint?.fullDate ?? 'Selected Period'}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="num text-[26px] font-bold tracking-tight text-ink">
              {rupees(Math.round((activePoint?.amount ?? 0) * 100))}
            </span>
            {avg > 0 && activePoint && (
              <span className="text-[11px] font-medium text-ink2">
                {diffAvg === 0
                  ? 'matches avg'
                  : diffAvg > 0
                  ? `+${diffAvg}% vs avg`
                  : `${diffAvg}% vs avg`}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10.5px] font-medium text-ink2 block">{periodMeta.totalLabel}</span>
          <span className="num text-[13px] font-semibold text-ink">
            {rupees(Math.round(total * 100))}
          </span>
        </div>
      </div>

      {/* Fluid Monochrome SVG Spline Curve */}
      <div
        role="img"
        aria-label={`Spending trajectory wave for ${periodMeta.button}. Total: ${rupees(
          Math.round(total * 100)
        )}.`}
        className="relative touch-manipulation select-none overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-xs outline-none focus:outline-none focus:ring-0 [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus:ring-0"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible outline-none focus:outline-none"
        >
          <defs>
            <linearGradient id="wave-monochrome-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.09" />
              <stop offset="85%" stopColor="var(--ink)" stopOpacity="0.01" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#wave-monochrome-gradient)"
              className="transition-all duration-300"
            />
          )}

          {/* Main Spline Wave Line */}
          {splinePath && (
            <path
              d={splinePath}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Points & Touch Targets */}
          {points.map((pt, i) => {
            const isActive = i === safeActiveIdx;
            const targetWidth = Math.max(28, plotWidth / points.length);

            return (
              <g key={pt.data.key} className="cursor-pointer outline-none focus:outline-none">
                {/* Touch / Click Target */}
                <rect
                  x={pt.x - targetWidth / 2}
                  y={0}
                  width={targetWidth}
                  height={height}
                  fill="transparent"
                  stroke="none"
                  className="outline-none focus:outline-none"
                  onClick={() => setActiveIdx(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                />

                {/* Node Ring on Wave */}
                {isActive ? (
                  <g className="transition-transform duration-200">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={13}
                      fill="var(--ink)"
                      fillOpacity={0.10}
                      stroke="none"
                    />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={6}
                      fill="var(--surface)"
                      stroke="var(--ink)"
                      strokeWidth={2.5}
                    />
                    <circle cx={pt.x} cy={pt.y} r={2} fill="var(--ink)" stroke="none" />
                  </g>
                ) : (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={2.5}
                    fill="var(--ink)"
                    fillOpacity={0.35}
                    stroke="none"
                    className="transition-opacity hover:fill-opacity-80"
                  />
                )}

                {/* Lowercase Period Label along bottom */}
                <text
                  x={pt.x}
                  y={height - 12}
                  textAnchor="middle"
                  fill="var(--ink)"
                  fillOpacity={isActive ? 1 : 0.45}
                  fontWeight={isActive ? 700 : 500}
                  fontSize={data.length > 7 ? (isActive ? 11 : 9.5) : (isActive ? 12.5 : 11)}
                  className="transition-all select-none lowercase pointer-events-none"
                >
                  {pt.data.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <DataTable
        caption={`${periodMeta.button} spending trajectory breakdown`}
        head={['Period', 'Spent']}
        rows={data.map((d) => [d.fullDate, rupees(Math.round(d.amount * 100))])}
      />
    </div>
  );
}
