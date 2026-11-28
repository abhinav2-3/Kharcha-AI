'use client';
import { useMemo, useState } from 'react';
import { ArrowDownNarrowWide, ArrowDownWideNarrow, ArrowUpDown, Calendar, Check, X, Search } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CATEGORY_META } from '@/lib/meta';
import { dayLabel, rupees } from '@/lib/format';
import type { Filter } from '@/lib/types';
import EntryRow from '@/components/EntryRow';

// ─── Types ───────────────────────────────────────────────────────────────────

type SortKey = 'date_desc' | 'amount_desc' | 'amount_asc';

interface SortOption {
  key: SortKey;
  label: string;
  shortLabel: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: SortOption[] = [
  {
    key: 'date_desc',
    label: 'Latest First',
    shortLabel: 'Latest',
    description: 'Reverse chronological order',
    Icon: Calendar,
  },
  {
    key: 'amount_desc',
    label: 'Highest Amount',
    shortLabel: '₹ High → Low',
    description: 'Largest amounts at the top',
    Icon: ArrowDownWideNarrow,
  },
  {
    key: 'amount_asc',
    label: 'Lowest Amount',
    shortLabel: '₹ Low → High',
    description: 'Smallest amounts at the top',
    Icon: ArrowDownNarrowWide,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sameFilter = (a: Filter, b: Filter) =>
  a.kind === b.kind &&
  (a.kind !== 'category' || (b.kind === 'category' && a.category === b.category));

// ─── Sort Sheet (Bottom Modal) ────────────────────────────────────────────────

function SortSheet({
  current,
  onSelect,
  onClose,
}: {
  current: SortKey;
  onSelect: (k: SortKey) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sort transactions"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 rounded-t-3xl border-t border-line bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-5 shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight text-ink">Sort By</h2>
            <p className="text-[13px] text-ink2">Choose how transactions are ordered</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sort sheet"
            className="grid h-9 w-9 place-items-center rounded-full text-ink2 hover:bg-tint active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <ul className="divide-y divide-line rounded-2xl border border-line bg-bg overflow-hidden">
          {SORT_OPTIONS.map(({ key, label, description, Icon }) => {
            const isActive = current === key;
            return (
              <li key={key}>
                <button
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors active:scale-[0.99] ${
                    isActive ? 'bg-tint' : 'hover:bg-tint'
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${
                      isActive ? 'bg-ink text-bg' : 'bg-surface text-ink2'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block text-[15px] font-semibold tracking-tight ${
                        isActive ? 'text-ink' : 'text-ink'
                      }`}
                    >
                      {label}
                    </span>
                    <span className="block text-[13px] text-ink2">{description}</span>
                  </div>
                  {isActive && (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-bg">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { sorted, loaded, filter, setFilter } = useStore();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(60);
  const [sortKey, setSortKey] = useState<SortKey>('date_desc');
  const [showSortSheet, setShowSortSheet] = useState(false);

  const isSortActive = sortKey !== 'date_desc';
  const activeSortOption = SORT_OPTIONS.find((o) => o.key === sortKey)!;

  // ── Filter chips ────────────────────────────────────────────────────────────
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

  // ── Filter (search + category) ──────────────────────────────────────────────
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

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const displayList = useMemo(() => {
    if (sortKey === 'date_desc') return filtered; // already sorted by store

    // Separate entries with valid amounts from ones without
    const withAmount = filtered.filter((e) => e.amount != null && e.parseStatus !== 'failed');
    const withoutAmount = filtered.filter((e) => e.amount == null || e.parseStatus === 'failed');

    const comparator = (a: (typeof filtered)[number], b: (typeof filtered)[number]) => {
      const diff =
        sortKey === 'amount_desc'
          ? (b.amount ?? 0) - (a.amount ?? 0)
          : (a.amount ?? 0) - (b.amount ?? 0);
      if (diff !== 0) return diff;
      // Tie-break: newer spentOn first
      return b.spentOn > a.spentOn ? 1 : b.spentOn < a.spentOn ? -1 : 0;
    };

    return [...withAmount].sort(comparator).concat(withoutAmount);
  }, [filtered, sortKey]);

  // ── Grouped (date_desc) or flat (amount sort) ──────────────────────────────
  const groups = useMemo(() => {
    if (sortKey !== 'date_desc') return null; // flat list when sorting by amount

    const g: { day: string; items: typeof filtered; total: number }[] = [];
    for (const e of displayList.slice(0, limit)) {
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
  }, [displayList, sortKey, limit]);

  const isFiltering = filter.kind !== 'all' || query.trim() !== '';

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-bg px-5 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        {/* Title row + Sort button */}
        <div className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold tracking-tight text-ink">History</h1>

          {/* Sort trigger pill */}
          <button
            onClick={() => setShowSortSheet(true)}
            aria-label={`Sort: ${activeSortOption.label}`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all active:scale-95 ${
              isSortActive
                ? 'border-ink bg-ink text-bg shadow-sm'
                : 'border-line bg-surface text-ink2 hover:bg-tint hover:text-ink'
            }`}
          >
            <ArrowUpDown size={13} />
            <span>{isSortActive ? activeSortOption.shortLabel : 'Sort'}</span>
          </button>
        </div>

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

      {/* ── List Content ───────────────────────────────────────────────────── */}
      {!loaded ? (
        <div className="space-y-3 px-5 pt-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skel h-14 w-full" />
          ))}
        </div>
      ) : displayList.length === 0 ? (
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
      ) : groups ? (
        /* Date-grouped list (default sort) */
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

          {displayList.length > limit && (
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
      ) : (
        /* Flat ranked list (amount sort) */
        <div className="mt-2">
          {/* Subtle sort context label */}
          <div className="flex items-center gap-1.5 px-5 pb-2 text-[12px] font-medium text-ink2">
            <activeSortOption.Icon size={12} />
            <span>{activeSortOption.label} · {displayList.length} entries</span>
          </div>

          <ul className="divide-y divide-line/70 border-y border-line/70 bg-surface">
            {displayList.slice(0, limit).map((entry) => (
              <li key={entry.clientId}>
                <EntryRow entry={entry} showDay={true} />
              </li>
            ))}
          </ul>

          {displayList.length > limit && (
            <div className="px-5 pb-4 pt-4">
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

      {/* ── Sort Bottom Sheet ──────────────────────────────────────────────── */}
      {showSortSheet && (
        <SortSheet
          current={sortKey}
          onSelect={(k) => {
            setSortKey(k);
            setLimit(60);
          }}
          onClose={() => setShowSortSheet(false)}
        />
      )}
    </div>
  );
}
