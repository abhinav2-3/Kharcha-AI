'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSpeech } from '@/lib/hooks';
import { MAX_RAW_TEXT } from '@/lib/constants';
import ListeningSheet from './ListeningSheet';

const ENGLISH_EXAMPLES = [
  '500 for coffee with cash',
  '300 for fuel via UPI',
  '20 for tea and 30 for snacks',
  'Salary credited 45000',
  '1200 electricity bill via card',
  '250 for lunch yesterday',
];

const HINDI_EXAMPLES = [
  '500 chai pe cash se',
  'kal petrol 300 upi',
  'chai 20 aur samosa 30',
  'salary aayi 45000',
  'paanch sau ka recharge',
  'dedh sau auto',
];

export default function Composer() {
  const { add, draft, setDraft, settings, setSettings } = useStore();
  const [text, setText] = useState('');
  const [exIdx, setExIdx] = useState(0);
  const fromVoice = useRef(false);
  const voiceAlternativesRef = useRef<string[] | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeExamples = settings.lang === 'hi-IN' ? HINDI_EXAMPLES : ENGLISH_EXAMPLES;

  const speech = useSpeech({
    lang: settings.lang || 'hi-IN',
    silenceTimeoutMs: 3000, // Waits 3 seconds after speaking before concluding voice input
    onFinal: (transcript, alternatives) => {
      fromVoice.current = true;
      voiceAlternativesRef.current = alternatives;
      if (settings.autoSend) {
        add(transcript, 'voice', alternatives);
        setText('');
        fromVoice.current = false;
        voiceAlternativesRef.current = undefined;
      } else {
        setText(transcript.slice(0, MAX_RAW_TEXT));
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    },
  });

  // Example chip click fills draft
  useEffect(() => {
    if (!draft) return;
    setText(draft);
    setDraft('');
    inputRef.current?.focus();
  }, [draft, setDraft]);

  // Rotate placeholder examples periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setExIdx((prev) => (prev + 1) % activeExamples.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [activeExamples.length]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    add(
      trimmed,
      fromVoice.current ? 'voice' : 'text',
      fromVoice.current ? voiceAlternativesRef.current : undefined
    );
    setText('');
    fromVoice.current = false;
    voiceAlternativesRef.current = undefined;
  };

  const handleSelectLang = (newLang: 'hi-IN' | 'en-IN') => {
    setSettings({ lang: newLang });
    if (speech.listening) {
      speech.cancel();
      setTimeout(() => speech.start(), 80);
    }
  };

  const nearLimit = text.length > MAX_RAW_TEXT - 60;
  const isVoiceOpen = speech.listening || !!speech.error;

  return (
    <>
      <div className="composer-fade fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-3 pb-3 pt-8">
        <form
          onSubmit={submit}
          className="flex items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-5 pr-1.5 shadow-[0_8px_24px_-10px_rgba(17,20,43,0.35)] focus-within:border-s1 transition-colors"
        >
          <label htmlFor="entry-input" className="sr-only">
            Describe an expense or income
          </label>
          <input
            id="entry-input"
            ref={inputRef}
            value={text}
            maxLength={MAX_RAW_TEXT}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) fromVoice.current = false;
            }}
            placeholder={ENGLISH_EXAMPLES[exIdx]}
            autoComplete="off"
            enterKeyHint="send"
            className="min-w-0 flex-1 border-none bg-transparent text-[16px] text-ink placeholder:text-muted outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
          />

          {nearLimit && (
            <span
              className={`num text-[12px] font-medium ${text.length >= MAX_RAW_TEXT ? 'text-danger' : 'text-muted'
                }`}
            >
              {text.length}/{MAX_RAW_TEXT}
            </span>
          )}

          {text.trim() ? (
            <button
              type="submit"
              aria-label="Add entry"
              className="grid h-11 w-11 place-items-center rounded-full bg-ink text-bg active:scale-95 transition-transform"
            >
              <ArrowUp size={22} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Speak an entry"
              onClick={speech.start}
              className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-ink active:scale-95 transition-transform"
            >
              <Mic size={22} strokeWidth={2.3} />
            </button>
          )}
        </form>
      </div>

      {isVoiceOpen && (
        <ListeningSheet
          listening={speech.listening}
          text={speech.text}
          error={speech.error}
          lang={settings.lang || 'hi-IN'}
          onSelectLang={handleSelectLang}
          onStop={speech.stop}
          onCancel={speech.cancel}
          onRetry={speech.start}
          onType={() => {
            speech.cancel();
            setTimeout(() => inputRef.current?.focus(), 60);
          }}
        />
      )}
    </>
  );
}

