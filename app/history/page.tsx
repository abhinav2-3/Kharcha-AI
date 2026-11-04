'use client';
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CATEGORY_META } from '@/lib/meta';
import { dayLabel, rupees } from '@/lib/format';
import type { Filter } from '@/lib/types';
import EntryRow from '@/components/EntryRow';

const sameFilter = (a: Filter, b: Filter) =>
  a.kind === b.kind &&
  (a.kind !== 'category' || (b.kind === 'category' && a.category === b.category));

export default function HistoryPage() {
  const { sorted, loaded, filter, setFilter } = useStore();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(60);

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    sorted.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    const topCats = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([c]) => c as keyof typeof CATEGORY_META);

    const list: { label: string; f: Filter }[] = [
      { label: 'All', f: { kind: 'all' } },
      { label: 'Expenses', f: { kind: 'expense' } },
      { label: 'Income', f: { kind: 'income' } },
      ...topCats.map((c) => ({
        label: CATEGORY_META[c]?.label || c,
        f: { kind: 'category', category: c } as Filter,
      })),
    ];

    if (filter.kind === 'category' && !list.some((x) => sameFilter(x.f, filter))) {
      list.push({
        label: CATEGORY_META[filter.category]?.label || filter.category,
        f: filter,
      });
    }
    return list;
  }, [sorted, filter]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sorted.filter((e) => {
      if (filter.kind === 'expense' && e.type !== 'expense') return false;
      if (filter.kind === 'income' && e.type !== 'income') return false;
      if (filter.kind === 'category' && e.category !== filter.category) return false;
      if (
        needle &&
        !`${e.note ?? ''} ${e.rawText} ${CATEGORY_META[e.category]?.label || ''}`
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [sorted, filter, query]);

  const groups = useMemo(() => {
    const g: { day: string; items: typeof filtered; total: number }[] = [];
    for (const e of filtered.slice(0, limit)) {
      let last = g[g.length - 1];
      if (!last || last.day !== e.spentOn) {
        last = { day: e.spentOn, items: [], total: 0 };
        g.push(last);
      }
      last.items.push(e);
      if (e.type === 'expense' && e.amount != null && e.parseStatus !== 'failed') {
        last.total += e.amount;
      }
    }
    return g;
  }, [filtered, limit]);

  const isFiltering = filter.kind !== 'all' || query.trim() !== '';

  return (
    <div>
      <header className="sticky top-0 z-10 bg-bg px-5 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        <h1 className="text-[26px] font-bold tracking-tight text-ink">History</h1>

        {/* Search input */}
        <div className="relative mt-3">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coffee, fuel, rent..."
            aria-label="Search entries"
            className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-10 text-[15px] text-ink outline-none placeholder:text-muted focus:border-s1 transition-colors"
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink2 hover:bg-tint"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="scroll-x -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {chips.map(({ label, f }) => {
            const active = sameFilter(f, filter);
            return (
              <button
                key={label}
                onClick={() => {
                  setFilter(f);
                  setLimit(60);
                }}
                aria-pressed={active}
                className={`shrink-0 rounded-full border px-4 py-2 text-[14px] font-medium transition-all ${
                  active
                    ? 'border-ink bg-ink text-bg shadow-sm'
                    : 'border-line bg-surface text-ink hover:bg-tint'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </header>

      {/* List Content */}
      {!loaded ? (
        <div className="space-y-3 px-5 pt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 pt-14 text-center">
          <p className="text-[18px] font-semibold text-ink">
            {isFiltering ? 'No matching expenses' : 'No entries yet'}
          </p>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[15px] text-ink2">
            {isFiltering
              ? 'Try a different search word or clear the active filter.'
              : 'Say or type your first expense below.'}
          </p>
          {isFiltering && (
            <button
              onClick={() => {
                setFilter({ kind: 'all' });
                setQuery('');
              }}
              className="mt-5 rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink hover:bg-tint transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-6">
          {groups.map((group) => (
            <section key={group.day}>
              <div className="flex items-baseline justify-between px-5 pb-2 text-[13px] font-medium text-ink2">
                <span>{dayLabel(group.day)}</span>
                {group.total > 0 && (
                  <span className="num font-semibold text-ink">{rupees(group.total)}</span>
                )}
              </div>
              <ul className="divide-y divide-line/70 border-y border-line/70 bg-surface">
                {group.items.map((entry) => (
                  <li key={entry.clientId}>
                    <EntryRow entry={entry} />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {filtered.length > limit && (
            <div className="px-5 pb-4 pt-2">
              <button
                onClick={() => setLimit((prev) => prev + 60)}
                className="w-full rounded-full border border-line bg-surface py-3 text-[14px] font-semibold text-ink hover:bg-tint transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

