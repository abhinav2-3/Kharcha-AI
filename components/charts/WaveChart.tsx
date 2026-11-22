'use client';
import { useState, useMemo } from 'react';
import { compact, monthLabel, monthName, rupees, todayIST, monthOf } from '@/lib/format';
import DataTable from './DataTable';

export interface WavePoint {
  key: string;
  label: string;
  fullDate: string;
  amount: number; // in rupees
  isCurrent?: boolean;
}

interface WaveChartProps {
  data: WavePoint[];
  currentMonth: string;
}

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

export default function WaveChart({ data, currentMonth }: WaveChartProps) {
  // Find index of current month in data, default to last point
  const defaultIdx = useMemo(() => {
    const found = data.findIndex((d) => d.key === currentMonth);
    return found !== -1 ? found : Math.max(0, data.length - 1);
  }, [data, currentMonth]);

  const [activeIdx, setActiveIdx] = useState<number>(defaultIdx);

  const activePoint = data[activeIdx] ?? data[data.length - 1];
  const max = Math.max(...data.map((d) => d.amount), 0);
  const avg = data.length > 0 ? Math.round(data.reduce((acc, d) => acc + d.amount, 0) / data.length) : 0;

  // ViewBox geometry
  const width = 480;
  const height = 165;
  const padX = 36;
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

  const activePt = points[activeIdx] ?? points[points.length - 1];

  // Difference vs 6-month average
  const diffAvg = activePoint && avg > 0 ? Math.round(((activePoint.amount - avg) / avg) * 100) : 0;

  return (
    <div className="select-none">
      {/* Wave Header / Active Inspector */}
      <div className="mb-3 flex items-baseline justify-between px-1">
        <div>
          <span className="text-[12px] font-medium text-ink2 block capitalize">
            {activePoint?.fullDate ?? 'Selected Month'}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="num text-[28px] font-bold tracking-tight text-ink">
              {rupees(Math.round((activePoint?.amount ?? 0) * 100))}
            </span>
            {avg > 0 && activePoint && (
              <span className="text-[11.5px] font-medium text-ink2">
                {diffAvg === 0
                  ? 'matches avg'
                  : diffAvg > 0
                  ? `+${diffAvg}% vs 6mo avg`
                  : `${diffAvg}% vs 6mo avg`}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-medium text-ink2 block">6-Mo Average</span>
          <span className="num text-[13px] font-semibold text-ink2">
            {rupees(Math.round(avg * 100))}
          </span>
        </div>
      </div>

      {/* Fluid Monochrome SVG Spline Curve */}
      <div
        role="img"
        aria-label={`Spending trajectory wave. Active month ${activePoint?.fullDate}: ${rupees(
          Math.round((activePoint?.amount ?? 0) * 100)
        )}.`}
        className="relative touch-manipulation overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-xs"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Soft monochrome gradient */}
            <linearGradient id="wave-monochrome-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.10" />
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
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Points & Touch Targets */}
          {points.map((pt, i) => {
            const isActive = i === activeIdx;

            return (
              <g key={pt.data.key} className="cursor-pointer">
                {/* Touch / Click Target */}
                <rect
                  x={pt.x - 24}
                  y={0}
                  width={48}
                  height={height}
                  fill="transparent"
                  onClick={() => setActiveIdx(i)}
                  onMouseEnter={() => setActiveIdx(i)}
                />

                {/* Node Ring on Wave */}
                {isActive ? (
                  <g className="transition-transform duration-200">
                    {/* Outer Pulsing Halo */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={14}
                      fill="var(--ink)"
                      fillOpacity={0.12}
                    />
                    {/* Ring Circle (Mibu style) */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={6.5}
                      fill="var(--surface)"
                      stroke="var(--ink)"
                      strokeWidth={2.75}
                    />
                    {/* Center Dot */}
                    <circle cx={pt.x} cy={pt.y} r={2} fill="var(--ink)" />
                  </g>
                ) : (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={3}
                    fill="var(--ink)"
                    fillOpacity={0.35}
                    className="transition-opacity hover:fill-opacity-80"
                  />
                )}

                {/* Lowercase Month Label along bottom (Mibu style: jul, aug, sep, oct, nov, dec) */}
                <text
                  x={pt.x}
                  y={height - 12}
                  textAnchor="middle"
                  fill="var(--ink)"
                  fillOpacity={isActive ? 1 : 0.45}
                  fontWeight={isActive ? 700 : 500}
                  fontSize={isActive ? 13 : 11.5}
                  className="transition-all select-none lowercase"
                >
                  {pt.data.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <DataTable
        caption="Monthly spending trajectory breakdown"
        head={['Month', 'Total Spent']}
        rows={data.map((d) => [d.fullDate, rupees(Math.round(d.amount * 100))])}
      />
    </div>
  );
}
