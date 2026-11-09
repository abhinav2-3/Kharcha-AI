'use client';
import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, ms = 450) {
  const [v, setV] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const cur = a + (target - a) * (1 - Math.pow(1 - p, 3));
      setV(cur);
      from.current = cur;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return v;
}

export type SpeechError = 'denied' | 'no-speech' | 'network' | 'no-mic' | 'unsupported' | 'unknown';

interface SpeechOptions {
  lang: string;
  /** Silence delay in ms to wait after user pauses speaking before finishing (default: 2800ms = 2.8s) */
  silenceTimeoutMs?: number;
  onFinal: (text: string, alternatives?: string[]) => void;
}

/**
 * Client-side browser Web Speech API wrapper with intelligent silence detection.
 */
export function useSpeech(opts: SpeechOptions) {
  const recRef = useRef<any>(null);
  const isActiveRef = useRef(false);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const alternativesRef = useRef<string[]>([]);
  const erroredRef = useRef(false);
  const cancelledRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const onFinalRef = useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;

  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const clearAllTimers = () => {
    if (capRef.current) {
      clearTimeout(capRef.current);
      capRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (initialSilenceTimerRef.current) {
      clearTimeout(initialSilenceTimerRef.current);
      initialSilenceTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
      try {
        recRef.current?.abort();
      } catch {}
    };
  }, []);

  const start = () => {
    // Guard against starting a second recognition instance while active
    if (isActiveRef.current) return;

    const w = typeof window !== 'undefined' ? (window as any) : {};
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    setError(null);
    setText('');
    finalRef.current = '';
    interimRef.current = '';
    alternativesRef.current = [];
    erroredRef.current = false;
    cancelledRef.current = false;
    clearAllTimers();

    if (!Rec) {
      setError('unsupported');
      return;
    }

    const rec = new Rec();
    rec.lang = optsRef.current.lang || 'hi-IN';
    rec.interimResults = true;
    // Set continuous to true so the browser doesn't abruptly cut off after 1 second
    rec.continuous = true;
    rec.maxAlternatives = 3;

    rec.onresult = (e: any) => {
      // User has spoken; clear the initial silence countdown
      if (initialSilenceTimerRef.current) {
        clearTimeout(initialSilenceTimerRef.current);
        initialSilenceTimerRef.current = null;
      }

      let fin = '';
      let interim = '';
      const altLists: string[][] = [[], [], []];

      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const primaryText = r[0]?.transcript || '';

        if (r.isFinal) {
          const trimmed = primaryText.trim();
          if (trimmed) {
            fin = fin ? `${fin} ${trimmed}` : trimmed;
          }
          // Capture candidate alternatives across final segments
          for (let k = 0; k < 3; k++) {
            const alt = r[k]?.transcript?.trim() || trimmed;
            if (alt) altLists[k].push(alt);
          }
        } else {
          const trimmed = primaryText.trim();
          if (trimmed) {
            interim = interim ? `${interim} ${trimmed}` : trimmed;
          }
        }
      }

      finalRef.current = fin.trim();
      interimRef.current = (fin ? (interim ? `${fin} ${interim}` : fin) : interim).trim();
      setText(interimRef.current);

      const mainCandidate = (finalRef.current || interimRef.current).trim();
      const gathered: string[] = [];
      for (let k = 1; k < 3; k++) {
        const textCandidate = altLists[k].join(' ').trim();
        if (textCandidate && textCandidate !== mainCandidate && !gathered.includes(textCandidate)) {
          gathered.push(textCandidate);
        }
      }
      alternativesRef.current = gathered;

      // Reset and trigger custom silence timeout (default: 2.8s pause before stopping)
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (mainCandidate) {
        const delay = optsRef.current.silenceTimeoutMs ?? 2800;
        silenceTimerRef.current = setTimeout(() => {
          try {
            rec.stop();
          } catch {}
        }, delay);
      }
    };

    rec.onerror = (e: any) => {
      clearAllTimers();
      isActiveRef.current = false;
      if (cancelledRef.current) return;
      erroredRef.current = true;
      const code = e?.error as string;
      setError(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'denied'
          : code === 'no-speech'
          ? 'no-speech'
          : code === 'network'
          ? 'network'
          : code === 'audio-capture'
          ? 'no-mic'
          : code === 'aborted'
          ? null
          : 'unknown'
      );
      setListening(false);
    };

    rec.onend = () => {
      clearAllTimers();
      isActiveRef.current = false;
      setListening(false);
      if (cancelledRef.current || erroredRef.current) return;
      const t = (finalRef.current || interimRef.current).trim();
      if (t) {
        onFinalRef.current(t, alternativesRef.current);
      } else {
        setError('no-speech');
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      isActiveRef.current = true;
      setListening(true);
    } catch {
      isActiveRef.current = false;
      setError('unknown');
      return;
    }

    // Initial wait timeout: if user taps mic and says nothing for 8 seconds, automatically close
    initialSilenceTimerRef.current = setTimeout(() => {
      if (!finalRef.current && !interimRef.current) {
        try {
          rec.stop();
        } catch {}
      }
    }, 8000);

    // Hard safety cap (25s) in case of persistent noisy background
    capRef.current = setTimeout(() => {
      try {
        rec.stop();
      } catch {}
    }, 25000);
  };

  const stop = () => {
    clearAllTimers();
    try {
      recRef.current?.stop();
    } catch {}
  };

  const cancel = () => {
    cancelledRef.current = true;
    isActiveRef.current = false;
    clearAllTimers();
    try {
      recRef.current?.abort();
    } catch {}
    setListening(false);
    setError(null);
    setText('');
  };

  const dismiss = () => {
    clearAllTimers();
    setError(null);
    setText('');
  };

  return { supported, listening, text, error, start, stop, cancel, dismiss };
}
