'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Trash2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Entry } from '@/lib/types';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_MODES,
  type AnyCategory,
  type EntryType,
  type PaymentMode,
} from '@/lib/constants';
import { CATEGORY_META, MODE_META } from '@/lib/meta';
import { parseAmountInput, todayIST } from '@/lib/format';

export default function EntrySheet() {
  const { editingId, entries, setEditingId } = useStore();
  const entry = entries.find((e) => e.clientId === editingId);

  if (!entry) return null;
  return <Form key={entry.clientId} entry={entry} onClose={() => setEditingId(null)} />;
}

function Form({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { update, remove } = useStore();
  const today = todayIST();

  const [amount, setAmount] = useState(
    entry.amount != null ? String(entry.amount / 100) : ''
  );
  const [type, setType] = useState<EntryType>(entry.type || 'expense');
  const [category, setCategory] = useState<AnyCategory>(entry.category || 'other');
  const [mode, setMode] = useState<PaymentMode>(entry.mode || 'cash');
  const [date, setDate] = useState(entry.spentOn || today);
  const [note, setNote] = useState(entry.note || '');
  const [touched, setTouched] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entry.amount == null) {
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [entry.amount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const parsedAmount = parseAmountInput(amount);
  const amountError =
    parsedAmount == null || parsedAmount <= 0
      ? 'Enter an amount greater than ₹0.'
      : parsedAmount > 10_000_000
      ? 'Amount exceeds ₹1,00,00,000. Please verify.'
      : null;

  const dateError = !date
    ? 'Please pick a date.'
    : date > today
    ? 'Date cannot be in the future.'
    : null;

  const isValid = !amountError && !dateError;

  const handleTypeChange = (t: EntryType) => {
    setType(t);
    const allowed = (t === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES) as readonly string[];
    if (!allowed.includes(category)) {
      setCategory(t === 'income' ? 'other_income' : 'other');
    }
  };

  const handleSave = () => {
    setTouched(true);
    if (!isValid || parsedAmount == null) return;

    update(entry.clientId, {
      amount: Math.round(parsedAmount * 100),
      type,
      category,
      mode,
      note: note.trim() || null,
      spentOn: date,
      spentAt:
        date === entry.spentOn
          ? entry.spentAt
          : new Date(`${date}T12:00:00+05:30`).toISOString(),
      parseStatus: 'manual',
    });
    onClose();
  };

  const handleDelete = () => {
    remove(entry.clientId);
    onClose();
  };

  const availableCategories =
    type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Edit entry"
    >
      <div className="anim-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full max-w-[430px] flex-col rounded-t-[28px] bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-semibold text-ink">
            {entry.parseStatus === 'failed' ? 'Add Details' : 'Edit Entry'}
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-tint text-ink hover:opacity-80"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Raw Text Preview */}
          {entry.rawText && (
            <div className="flex items-start gap-2 rounded-xl bg-tint px-3.5 py-2.5 text-[14px] text-ink2">
              {entry.source === 'voice' && <Mic size={15} className="mt-0.5 shrink-0 text-accent-ink" />}
              <span>Original note: &ldquo;{entry.rawText}&rdquo;</span>
            </div>
          )}

          {/* Type Toggle */}
          <div className="grid grid-cols-2 rounded-xl bg-tint p-1">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`rounded-lg py-2 text-[14px] font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink2 hover:text-ink'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`rounded-lg py-2 text-[14px] font-semibold transition-all ${
                type === 'income'
                  ? 'bg-surface text-income shadow-sm'
                  : 'text-ink2 hover:text-ink'
              }`}
            >
              Income
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label htmlFor="edit-amount" className="block text-[13px] font-medium text-ink2 mb-1.5">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-semibold text-muted">
                ₹
              </span>
              <input
                id="edit-amount"
                ref={amountRef}
                type="number"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-[24px] font-bold text-ink outline-none focus:border-s1"
              />
            </div>
            {touched && amountError && (
              <p className="mt-1.5 text-[13px] font-medium text-danger">{amountError}</p>
            )}
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-[13px] font-medium text-ink2 mb-2">Category</label>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
              {availableCategories.map((cat) => {
                const isSelected = category === cat;
                const meta = CATEGORY_META[cat];
                const Icon = meta?.icon;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                      isSelected
                        ? 'border-ink bg-ink text-bg'
                        : 'border-line bg-surface text-ink hover:bg-tint'
                    }`}
                  >
                    {Icon && <Icon size={14} />}
                    <span>{meta?.label || cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-[13px] font-medium text-ink2 mb-2">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.filter((m) => m !== 'unknown').map((m) => {
                const isSelected = mode === m;
                const meta = MODE_META[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                      isSelected
                        ? 'border-ink bg-ink text-bg'
                        : 'border-line bg-surface text-ink hover:bg-tint'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta?.color || 'var(--s1)' }}
                    />
                    <span>{meta?.label || m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Note Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-date" className="block text-[13px] font-medium text-ink2 mb-1.5">
                Date
              </label>
              <input
                id="edit-date"
                type="date"
                max={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-s1"
              />
              {touched && dateError && (
                <p className="mt-1 text-[12px] font-medium text-danger">{dateError}</p>
              )}
            </div>

            <div>
              <label htmlFor="edit-note" className="block text-[13px] font-medium text-ink2 mb-1.5">
                Note (Optional)
              </label>
              <input
                id="edit-note"
                type="text"
                maxLength={60}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Starbucks, groceries"
                className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-s1 placeholder:text-muted"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 border-t border-line px-5 py-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete entry"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-danger/30 text-danger hover:bg-danger-bg transition-colors"
          >
            <Trash2 size={20} />
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-12 flex-1 rounded-2xl bg-brand text-[16px] font-semibold text-on-brand shadow-md hover:opacity-95 active:scale-[0.98] transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

