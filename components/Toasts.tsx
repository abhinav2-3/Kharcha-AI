'use client';
import { useStore } from '@/lib/store';

export default function Toasts() {
  const { toasts, dismissToast } = useStore();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => {
        const bg =
          t.kind === 'error'
            ? 'bg-danger-bg text-danger border-danger/30'
            : t.kind === 'warn'
            ? 'bg-warn-bg text-warn border-warn/30'
            : t.kind === 'info'
            ? 'bg-tint text-ink border-line'
            : 'bg-ink text-bg border-transparent';

        return (
          <div
            key={t.id}
            role="status"
            className={`anim-toast pointer-events-auto flex max-w-[400px] items-center gap-3 rounded-full border px-4 py-2.5 text-[14px] font-medium shadow-lg ${bg}`}
          >
            <span className="truncate">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.run();
                  dismissToast(t.id);
                }}
                className="shrink-0 rounded-full bg-surface/30 px-3 py-1 text-[13px] font-bold text-accent hover:opacity-90 active:scale-95"
              >
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

