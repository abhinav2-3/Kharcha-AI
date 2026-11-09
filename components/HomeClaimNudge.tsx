'use client';
import { useStore } from '@/lib/store';
import GoogleSignInButton from './GoogleSignInButton';
import { CloudCheck, X } from 'lucide-react';

export default function HomeClaimNudge() {
  const { user, entries, nudgeActive, dismissNudge } = useStore();

  // If user is already claimed, or entries < 3, or not active for today: don't show
  if (!user || !user.isGuest || entries.length < 3 || !nudgeActive) {
    return null;
  }

  return (
    <section className="relative mx-5 my-4 overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Dismiss Button */}
      <button
        onClick={dismissNudge}
        aria-label="Remind me later"
        className="absolute right-3.5 top-3.5 grid h-8 w-8 place-items-center rounded-full text-ink2 hover:bg-tint hover:text-ink active:scale-95 transition-colors"
      >
        <X size={17} />
      </button>

      <div className="flex items-start gap-3.5 pr-7">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink shadow-xs">
          <CloudCheck size={20} />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-ink">
            Keep your {entries.length} expenses safe
          </h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">
            Link your Google account in one tap so you never lose your data when switching devices or clearing browser cache.
          </p>
        </div>
      </div>

      <div className="mt-4.5 flex justify-start pl-[52px]">
        <GoogleSignInButton
          theme="outline"
          shape="pill"
          size="medium"
          text="continue_with"
          width={220}
        />
      </div>
    </section>
  );
}

