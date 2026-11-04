'use client';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { byCategory } from '@/lib/stats';
import { CATEGORY_META } from '@/lib/meta';
import { rupees } from '@/lib/format';
import CategoryChip from '../CategoryChip';

interface Props {
  rows: ReturnType<typeof byCategory>;
  limit?: number;
}

export default function CategoryBars({ rows, limit }: Props) {
  const router = useRouter();
  const { setFilter } = useStore();
  const shown = limit ? rows.slice(0, limit) : rows;
  const top = rows[0]?.paise || 1;

  return (
    <ul className="divide-y divide-line/60">
      {shown.map((r) => {
        const meta = CATEGORY_META[r.category] || CATEGORY_META.other;
        return (
          <li key={r.category}>
            <button
              onClick={() => {
                setFilter({ kind: 'category', category: r.category });
                router.push('/history');
              }}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-tint/60 active:bg-tint"
            >
              <CategoryChip category={r.category} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-medium text-ink">
                    {meta.label}
                  </span>
                  <span className="num text-[15px] font-semibold text-ink">
                    {rupees(r.paise)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-tint overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-s1 transition-all"
                      style={{ width: `${Math.max(3, (r.paise / top) * 100)}%` }}
                    />
                  </div>
                  <span className="num w-9 text-right text-[12px] font-medium text-ink2">
                    {Math.round(r.share * 100)}%
                  </span>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

