'use client';
import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareHeart, Send } from 'lucide-react';
import { sendFeedback } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function DeveloperFeedback() {
  const { toast, settings } = useStore();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'idea' | 'bug' | 'other'>('idea');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      toast({ kind: 'warn', message: 'Please write at least 3 characters.' });
      return;
    }

    setSubmitting(true);
    try {
      await sendFeedback({
        message: trimmed,
        category,
        metadata: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          screen:
            typeof window !== 'undefined'
              ? `${window.innerWidth}x${window.innerHeight}`
              : undefined,
          theme: settings.theme,
        },
      });

      setSubmitted(true);
      setMessage('');
      toast({ kind: 'success', message: 'Feedback sent! Thank you for helping improve Kharcha.' });
    } catch (err: any) {
      toast({
        kind: 'error',
        message: err?.message || 'Failed to send feedback. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink shadow-xs">
          <MessageSquareHeart size={20} />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-ink">
            Feedback for Developer
          </h3>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink2">
            Found a bug, want a new feature, or have thoughts? Share it directly.
          </p>
        </div>
      </div>

      {submitted ? (
        <div className="mt-4 rounded-xl border border-good/20 bg-good-bg/40 p-4 text-center animate-in fade-in duration-200">
          <div className="flex items-center justify-center gap-2 text-good font-semibold text-[15px]">
            <CheckCircle2 size={18} />
            <span>Thank you for your feedback!</span>
          </div>
          <p className="mt-1 text-[13px] text-ink2">
            Your note was received and will be reviewed to make Kharcha better.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-3 text-[13px] font-medium text-ink underline hover:text-accent-ink transition-colors"
          >
            Send another message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'idea', label: '💡 Feature Idea' },
                { id: 'bug', label: '🐛 Bug Report' },
                { id: 'other', label: '💬 General' },
              ] as const
            ).map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-all ${
                    active
                      ? 'bg-accent text-accent-ink shadow-xs'
                      : 'border border-line bg-tint text-ink2 hover:text-ink'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your feedback here..."
              maxLength={1000}
              disabled={submitting}
              className="w-full rounded-xl border border-line bg-tint/40 p-3 text-[14.5px] text-ink placeholder:text-ink2/60 focus:border-s1 focus:bg-surface focus:outline-none transition-all resize-none"
            />
            <span className="absolute bottom-2.5 right-3 text-[11px] text-ink2/70 font-mono">
              {message.length}/1000
            </span>
          </div>

          {/* Action Row */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || message.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-xs hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Send Feedback</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

