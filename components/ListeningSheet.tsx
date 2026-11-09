'use client';
import { useEffect, useState } from 'react';
import { MicOff, Square, WifiOff } from 'lucide-react';
import type { SpeechError } from '@/lib/hooks';

const ERRORS: Record<SpeechError, { title: string; body: string; retry: boolean }> = {
  denied: {
    title: 'Microphone is blocked',
    body: 'Allow microphone access for Kharcha in your browser settings to speak expenses.',
    retry: true,
  },
  'no-speech': {
    title: 'Didn’t catch that',
    body: 'No speech was detected. Hold the device closer and speak clearly in one go.',
    retry: true,
  },
  network: {
    title: 'Voice typing needs internet',
    body: 'Voice transcription uses browser speech services. Check your internet connection or type instead.',
    retry: true,
  },
  'no-mic': {
    title: 'No microphone found',
    body: 'Please connect a working microphone, or type your entry instead.',
    retry: false,
  },
  unsupported: {
    title: 'Voice isn’t available here',
    body: 'This browser does not support client-side speech recognition. Chrome works best. You can always type.',
    retry: false,
  },
  unknown: {
    title: 'Voice error occurred',
    body: 'Something interrupted voice recognition. Try again or type your expense.',
    retry: true,
  },
};

interface Props {
  listening: boolean;
  text: string;
  error: SpeechError | null;
  lang: 'hi-IN' | 'en-IN';
  onSelectLang: (lang: 'hi-IN' | 'en-IN') => void;
  onStop: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onType: () => void;
}

export default function ListeningSheet({
  listening,
  text,
  error,
  lang,
  onSelectLang,
  onStop,
  onCancel,
  onRetry,
  onType,
}: Props) {
  const err = error ? ERRORS[error] : null;
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('kharcha.mic_hint_seen');
      if (!seen) {
        setShowHint(true);
        localStorage.setItem('kharcha.mic_hint_seen', '1');
      }
    } catch {}
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Voice input"
    >
      <div
        className="anim-fade absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={err ? onType : onCancel}
      />
      <div className="anim-sheet relative w-full max-w-[430px] rounded-t-[28px] bg-surface px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-line" />

        {err ? (
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-warn-bg text-warn">
              {error === 'network' ? <WifiOff size={26} /> : <MicOff size={26} />}
            </span>
            <h2 className="mt-4 text-[20px] font-semibold text-ink">{err.title}</h2>
            <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-ink2">
              {err.body}
            </p>

            {error === 'denied' && (
              <div className="mt-4 w-full rounded-2xl bg-tint p-3.5 text-left text-[13px] leading-relaxed text-ink2">
                <p className="font-semibold text-ink">To allow in Chrome:</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-ink2">
                  <li>Tap the lock or site settings icon (🔒 / ⚙️) by the address bar.</li>
                  <li>Set <strong>Microphone</strong> to <strong>Allow</strong>.</li>
                  <li>Tap &ldquo;Try again&rdquo; or refresh the page.</li>
                </ol>
              </div>
            )}

            <div className="mt-6 flex w-full gap-3">
              <button
                onClick={onType}
                className="h-12 flex-1 rounded-full border border-line text-[16px] font-semibold text-ink hover:bg-tint"
              >
                Type instead
              </button>
              {err.retry && (
                <button
                  onClick={onRetry}
                  className="h-12 flex-1 rounded-full bg-accent text-[16px] font-semibold text-accent-ink hover:opacity-90"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            {showHint && (
              <div className="mb-2 rounded-full bg-accent-soft px-3.5 py-1 text-[13px] font-medium text-accent-ink">
                Speak close to the mic and say it in one go.
              </div>
            )}

            {/* Compact language toggle chip ("हिं / EN") */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-[13px] font-medium text-ink2">
                Listening • {lang === 'hi-IN' ? 'Hindi' : 'English'}
              </span>
              <div className="inline-flex rounded-full bg-tint p-0.5 border border-line/60">
                <button
                  type="button"
                  onClick={() => onSelectLang('hi-IN')}
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-all ${
                    lang === 'hi-IN' ? 'bg-surface text-ink shadow-xs' : 'text-ink2 hover:text-ink'
                  }`}
                >
                  हिं
                </button>
                <button
                  type="button"
                  onClick={() => onSelectLang('en-IN')}
                  className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold transition-all ${
                    lang === 'en-IN' ? 'bg-surface text-ink shadow-xs' : 'text-ink2 hover:text-ink'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <p
              aria-live="polite"
              className={`mt-3 flex min-h-[84px] items-center text-[22px] font-semibold leading-snug ${
                text ? 'text-ink' : 'text-muted'
              }`}
            >
              {text ||
                (lang === 'hi-IN'
                  ? 'बोलिए "500 chai pe cash se"...'
                  : 'Say "500 for coffee with cash"...')}
            </p>

            <div className="mt-4 flex h-10 items-center gap-1.5" aria-hidden="true">
              {[0.0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2].map((d, i) => (
                <span
                  key={i}
                  className="anim-wave h-10 w-1.5 rounded-full bg-s1"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>

            <div className="relative mt-6 grid h-[88px] w-[88px] place-items-center">
              <span className="anim-ripple absolute inset-0 rounded-full bg-accent" />
              <span
                className="anim-ripple absolute inset-0 rounded-full bg-accent"
                style={{ animationDelay: '0.9s' }}
              />
              <button
                onClick={onStop}
                aria-label="Finish speaking"
                disabled={!listening}
                className="relative grid h-[76px] w-[76px] place-items-center rounded-full bg-accent text-accent-ink shadow-lg active:scale-95"
              >
                <Square size={26} fill="currentColor" />
              </button>
            </div>
            <p className="mt-6 text-[14px] text-ink2">Tap button to finish</p>
            <button
              onClick={onCancel}
              className="mt-4 rounded-full px-5 py-2 text-[15px] font-semibold text-ink2 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

