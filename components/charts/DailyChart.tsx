'use client';
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
import { compact, monthName, monthOf, rupees, todayIST, dayOfMonth } from '@/lib/format';
import DataTable from './DataTable';

type Pt = { day: number; amount: number };

function Tip({ active, payload, month }: any) {
  if (!active || !payload?.length) return null;
  const p: Pt = payload[0].payload;
  return (
    <div className="rounded-xl bg-ink px-3 py-2 text-[13px] text-bg shadow-lg">
      <p className="opacity-75">
        {p.day} {monthName(month).slice(0, 3)}
      </p>
      <p className="num text-[15px] font-semibold text-accent">
        {rupees(Math.round(p.amount * 100))}
      </p>
    </div>
  );
}

export default function DailyChart({ data, month }: { data: Pt[]; month: string }) {
  const today = todayIST();
  const isCurrent = month === monthOf(today);
  const todayDay = dayOfMonth(today);
  const max = Math.max(...data.map((d) => d.amount), 0);
  const maxIdx = data.findIndex((d) => d.amount === max);
  const ticks = [1, 8, 15, 22, 29].filter((t) => t <= data.length);
  if (isCurrent && !ticks.includes(todayDay) && todayDay - ticks[ticks.length - 1] > 2) {
    ticks.push(todayDay);
  }

  return (
    <div>
      <div
        role="img"
        aria-label={`Daily spending for ${monthName(month)}. Peak day: ${rupees(
          Math.round(max * 100)
        )}.`}
      >
        <ResponsiveContainer width="100%" height={168}>
          <BarChart data={data} margin={{ top: 20, right: 2, left: 0, bottom: 0 }} barCategoryGap="18%">
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
              width={34}
              tickCount={3}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              tickFormatter={(v) => (v === 0 ? '0' : compact(v))}
            />
            <Tooltip cursor={{ fill: 'var(--tint)' }} content={<Tip month={month} />} />
            <Bar
              dataKey="amount"
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              isAnimationActive={false}
              label={(p: any) =>
                p.index === maxIdx && max > 0 ? (
                  <text
                    x={p.x + p.width / 2}
                    y={p.y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill="var(--ink)"
                  >
                    {compact(max)}
                  </text>
                ) : (
                  <g />
                )
              }
            >
              {data.map((d) => (
                <Cell
                  key={d.day}
                  fill="var(--s1)"
                  fillOpacity={isCurrent && d.day !== todayDay ? 0.6 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Daily spending breakdown"
        head={['Day', 'Spent']}
        rows={data
          .filter((d) => d.amount > 0)
          .map((d) => [
            `${d.day} ${monthName(month).slice(0, 3)}`,
            rupees(Math.round(d.amount * 100)),
          ])}
      />
    </div>
  );
}

