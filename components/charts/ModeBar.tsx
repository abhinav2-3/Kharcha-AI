import type { byMode } from '@/lib/stats';
import { MODE_META } from '@/lib/meta';
import { rupees } from '@/lib/format';

/** One whole bar (all spending) split into payment modes with fixed color per mode. */
export default function ModeBar({ rows }: { rows: ReturnType<typeof byMode> }) {
  if (!rows.length) return null;

  return (
    <div>
      <div
        className="flex h-7 gap-[2px] overflow-hidden rounded-[8px]"
        role="img"
        aria-label={rows
          .map((r) => `${MODE_META[r.mode]?.label || r.mode} ${Math.round(r.share * 100)}%`)
          .join(', ')}
      >
        {rows.map((r) => {
          const meta = MODE_META[r.mode] || MODE_META.other;
          return (
            <div
              key={r.mode}
              className="flex min-w-[6px] items-center overflow-hidden rounded-[4px] pl-2 text-[12px] font-semibold"
              style={{
                flex: r.paise,
                background: meta.color,
                color: r.mode === 'bank_transfer' ? '#0b0b0b' : '#fff',
              }}
              title={`${meta.label} • ${rupees(r.paise)}`}
            >
              {r.share >= 0.14 ? `${Math.round(r.share * 100)}%` : ''}
            </div>
          );
        })}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {rows.map((r) => {
          const meta = MODE_META[r.mode] || MODE_META.other;
          return (
            <li key={r.mode} className="flex items-center gap-2 text-[14px]">
              <span
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ background: meta.color }}
              />
              <span className="text-ink2">{meta.label}</span>
              <span className="num ml-auto font-semibold text-ink">{rupees(r.paise)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

