'use client';
import { AlertCircle, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import type { Entry } from '@/lib/types';
import { CATEGORY_META, MODE_META } from '@/lib/meta';
import { dayLabel, rupees, timeLabel } from '@/lib/format';
import { useStore } from '@/lib/store';
import CategoryChip from './CategoryChip';

export default function EntryRow({
  entry: e,
  showDay = false,
}: {
  entry: Entry;
  showDay?: boolean;
}) {
  const { setEditingId, retry } = useStore();
  const base = 'flex w-full items-center gap-3 px-5 py-3 text-left transition-colors';

  // 1. Pending (Sent, waiting for parser)
  if (e.sync === 'pending') {
    return (
      <div className={base} aria-busy="true">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-tint text-muted">
          <Loader2 size={18} className="animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] text-ink2">{e.rawText}</p>
          <p className="text-[13px] text-muted">Analyzing your expense...</p>
        </div>
        <div className="skel h-5 w-16" />
      </div>
    );
  }

  // 2. Error (Network, server, or rate limit issue)
  if (e.sync === 'error') {
    return (
      <div className={`${base} bg-danger-bg`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-surface text-danger">
          <CloudOff size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium text-ink">{e.rawText}</p>
          <p className="text-[13px] font-medium text-danger">
            Not sent • {e.errorMessage || 'Please retry'}
          </p>
        </div>
        <button
          onClick={() => retry(e.clientId)}
          className="flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[14px] font-semibold text-ink shadow-sm active:scale-95"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  // 3. Amount missing (user typed or spoke without specifying price)
  if (e.parseStatus === 'failed' || e.amount == null) {
    return (
      <button
        onClick={() => setEditingId(e.clientId)}
        className={`${base} bg-warn-bg ${e.fresh ? 'anim-settle' : ''}`}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-surface text-warn">
          <AlertCircle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-medium text-ink">{e.rawText}</p>
          <p className="text-[13px] font-medium text-warn">Amount missing • not counted yet</p>
        </div>
        <span className="rounded-full bg-accent px-3.5 py-2 text-[14px] font-semibold text-accent-ink shadow-sm">
          Add amount
        </span>
      </button>
    );
  }

  // 4. Normal Synced Entry
  const isIncome = e.type === 'income';
  const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
  const modeMeta = MODE_META[e.mode] || MODE_META.cash;
  const title = e.note || meta.label;

  return (
    <button
      onClick={() => setEditingId(e.clientId)}
      className={`${base} hover:bg-tint/60 active:bg-tint ${e.fresh ? 'anim-settle' : ''}`}
    >
      <CategoryChip category={e.category} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-medium text-ink">{title}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[13px] text-ink2">
          <span>{showDay ? `${dayLabel(e.spentOn)}, ` : ''}{timeLabel(e.spentAt)}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: modeMeta.color }}
            />
            {modeMeta.label}
          </span>
        </div>
      </div>

      <span
        className={`num text-[17px] font-semibold tracking-tight ${
          isIncome ? 'text-income' : 'text-ink'
        }`}
      >
        {isIncome ? '+' : ''}
        {rupees(e.amount)}
      </span>
    </button>
  );
}

