'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { monthLabel, shiftMonth, todayIST } from '@/lib/format';

export default function MonthSwitcher({ onBrand = false }: { onBrand?: boolean }) {
  const { month, setMonth } = useStore();
  const currentMonth = todayIST().slice(0, 7);
  const isFuture = month >= currentMonth;

  const btnClass = onBrand
    ? 'text-on-brand/80 hover:text-on-brand disabled:opacity-30 active:scale-95'
    : 'text-ink2 hover:text-ink disabled:opacity-30 active:scale-95';

  return (
    <div className="flex items-center gap-1.5">
      <button
        aria-label="Previous month"
        onClick={() => setMonth(shiftMonth(month, -1))}
        className={`grid h-8 w-8 place-items-center rounded-full ${btnClass}`}
      >
        <ChevronLeft size={18} />
      </button>

      <span
        className={`text-[14px] font-semibold ${
          onBrand ? 'text-on-brand' : 'text-ink'
        }`}
      >
        {monthLabel(month)}
      </span>

      <button
        aria-label="Next month"
        disabled={isFuture}
        onClick={() => setMonth(shiftMonth(month, 1))}
        className={`grid h-8 w-8 place-items-center rounded-full ${btnClass}`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

