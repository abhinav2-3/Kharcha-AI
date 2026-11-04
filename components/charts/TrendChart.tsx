'use client';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { compact, monthName, rupees } from '@/lib/format';
import DataTable from './DataTable';

type Pt = { day: number; cur: number | null; prev: number | null };

function Tip({ active, payload, label, cur, prev }: any) {
  if (!active || !payload?.length) return null;
  const p: Pt = payload[0].payload;
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-[13px] text-bg shadow-lg">
      <p className="opacity-75">Day {label}</p>
      {p.cur != null && (
        <p className="num font-semibold text-accent">
          {cur}: {rupees(Math.round(p.cur * 100))}
        </p>
      )}
      {p.prev != null && (
        <p className="num opacity-80">
          {prev}: {rupees(Math.round(p.prev * 100))}
        </p>
      )}
    </div>
  );
}

export default function TrendChart({
  data,
  month,
  prevMonth,
}: {
  data: Pt[];
  month: string;
  prevMonth: string;
}) {
  const curName = monthName(month);
  const prevName = monthName(prevMonth);
  const last = [...data].reverse().find((d) => d.cur != null);
  const ticks = [1, 8, 15, 22, 29].filter((t) => t <= data.length);

  return (
    <div>
      <div className="mb-2 flex items-center gap-5 text-[13px] text-ink2">
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-5 rounded-full bg-s1" />
          {curName}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-5 rounded-full bg-[var(--s-other)]" />
          {prevName}
        </span>
      </div>

      <div
        role="img"
        aria-label={`Running total of spending in ${curName} compared with ${prevName}.`}
      >
        <ResponsiveContainer width="100%" height={188}>
          <LineChart data={data} margin={{ top: 18, right: 14, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="day"
              ticks={ticks}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={38}
              tickCount={4}
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              tickFormatter={(v) => (v === 0 ? '0' : compact(v))}
            />
            <Tooltip
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              content={<Tip cur={curName} prev={prevName} />}
            />
            <Line
              type="monotone"
              dataKey="prev"
              stroke="var(--s-other)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: 'var(--s-other)',
                stroke: 'var(--surface)',
                strokeWidth: 2,
              }}
              strokeLinecap="round"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="cur"
              stroke="var(--s1)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                fill: 'var(--s1)',
                stroke: 'var(--surface)',
                strokeWidth: 2,
              }}
              strokeLinecap="round"
              connectNulls={false}
              isAnimationActive={false}
            />
            {last && last.cur != null && (
              <ReferenceDot
                x={last.day}
                y={last.cur}
                r={5}
                fill="var(--s1)"
                stroke="var(--surface)"
                strokeWidth={2}
                label={{
                  value: compact(last.cur),
                  position: 'top',
                  fontSize: 12,
                  fontWeight: 600,
                  fill: 'var(--ink)',
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        caption="Running total of spending"
        head={['Day', curName, prevName]}
        rows={data
          .filter((d) => d.day % 5 === 0 || d.day === 1)
          .map((d) => [
            String(d.day),
            d.cur == null ? '-' : rupees(Math.round(d.cur * 100)),
            d.prev == null ? '-' : rupees(Math.round(d.prev * 100)),
          ])}
      />
    </div>
  );
}

