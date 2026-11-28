'use client';
import { useState } from 'react';
import { Check, Plus, X, Building2, QrCode, Banknote } from 'lucide-react';
import { useStore } from '@/lib/store';
import { rupees, todayIST, dayLabel, parseAmountInput } from '@/lib/format';
import type { AnyCategory, PaymentMode } from '@/lib/constants';

interface AddIncomeSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const INCOME_CATEGORIES: { id: AnyCategory; label: string }[] = [
  { id: 'salary', label: 'Salary' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'business', label: 'Business' },
  { id: 'refund', label: 'Refund' },
  { id: 'gift_received', label: 'Gift' },
  { id: 'other_income', label: 'Other' },
];

const PAYMENT_MODES: { id: PaymentMode; label: string; icon: React.ElementType }[] = [
  { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
  { id: 'upi', label: 'UPI', icon: QrCode },
  { id: 'cash', label: 'Cash', icon: Banknote },
];

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

export default function AddIncomeSheet({ isOpen, onClose }: AddIncomeSheetProps) {
  const { add, toast } = useStore();
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<AnyCategory>('salary');
  const [mode, setMode] = useState<PaymentMode>('bank_transfer');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const parsedAmount = parseAmountInput(amountStr);
  const isValidAmount = parsedAmount != null && parsedAmount > 0 && parsedAmount <= 10_000_000;

  const handleAddPreset = (val: number) => {
    const current = parseAmountInput(amountStr) || 0;
    setAmountStr(String(current + val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount || submitting) return;

    setSubmitting(true);
    try {
      // Construct a clean, natural raw text representation for parsing & audit
      const catWord =
        category === 'salary'
          ? 'Salary'
          : category === 'freelance'
          ? 'Freelance income'
          : category === 'business'
          ? 'Business income'
          : category === 'refund'
          ? 'Refund'
          : category === 'gift_received'
          ? 'Gift received'
          : 'Income';

      const modeWord =
        mode === 'bank_transfer'
          ? 'via bank transfer'
          : mode === 'upi'
          ? 'via UPI'
          : 'in cash';

      const noteWord = note.trim() ? ` for ${note.trim()}` : '';
      const rawText = `${catWord} ${parsedAmount} credited ${modeWord}${noteWord}`;

      await add(rawText, 'text');

      toast({
        kind: 'success',
        message: `${rupees(parsedAmount * 100)} credited to Income!`,
      });

      // Reset and close
      setAmountStr('');
      setNote('');
      setCategory('salary');
      setMode('bank_transfer');
      onClose();
    } catch (err: any) {
      toast({
        kind: 'error',
        message: err?.message || 'Could not record income. Please retry.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Income"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 rounded-t-3xl border-t border-line bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5 shadow-2xl"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[19px] font-bold tracking-tight text-ink">Add Income</h2>
            <p className="text-[13px] text-ink2">
              Credited on {dayLabel(todayIST())}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink2 hover:bg-tint active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount Input */}
          <div>
            <label className="text-[12.5px] font-medium text-ink2">Amount</label>
            <div className="relative mt-1 flex items-center rounded-2xl border border-line bg-bg px-4 py-2.5 focus-within:border-ink transition-colors">
              <span className="text-[26px] font-bold text-ink2">₹</span>
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full bg-transparent pl-2 text-[30px] font-bold tracking-tight text-ink outline-none placeholder:text-muted"
              />
              {amountStr && (
                <button
                  type="button"
                  onClick={() => setAmountStr('')}
                  className="grid h-7 w-7 place-items-center rounded-full text-ink2 hover:bg-tint"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick preset chips */}
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {PRESET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleAddPreset(val)}
                  className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink2 hover:border-ink hover:text-ink active:scale-95 transition-all"
                >
                  +₹{val >= 1000 ? `${val / 1000}k` : val}
                </button>
              ))}
            </div>
          </div>

          {/* Income Source / Category */}
          <div>
            <label className="text-[12.5px] font-medium text-ink2">Source</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {INCOME_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all ${
                      isSelected
                        ? 'border-ink bg-ink text-bg shadow-xs'
                        : 'border-line bg-bg text-ink hover:bg-tint'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="text-[12.5px] font-medium text-ink2">Payment Mode</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((m) => {
                const isSelected = mode === m.id;
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[12.5px] font-medium transition-all ${
                      isSelected
                        ? 'border-ink bg-ink text-bg shadow-xs'
                        : 'border-line bg-bg text-ink2 hover:bg-tint hover:text-ink'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="text-[12.5px] font-medium text-ink2">
              Note <span className="text-muted">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. November salary, client project"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-line bg-bg px-3.5 text-[14px] text-ink placeholder:text-muted outline-none focus:border-ink transition-colors"
            />
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={!isValidAmount || submitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-[15px] font-semibold text-bg shadow-sm transition-all active:scale-[0.99] disabled:opacity-40"
          >
            <Plus size={16} />
            <span>
              {isValidAmount
                ? `Add ${rupees(parsedAmount * 100)} to Income`
                : 'Enter an amount'}
            </span>
          </button>
        </form>
      </div>
    </>
  );
}
