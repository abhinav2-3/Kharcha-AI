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
  onFinal: (text: string) => void;
}

/**
 * Client-side browser Web Speech API wrapper.
 */
export function useSpeech(opts: SpeechOptions) {
  const recRef = useRef<any>(null);
  const finalRef = useRef('');
  const interimRef = useRef('');
  const erroredRef = useRef(false);
  const cancelledRef = useRef(false);
  const onFinalRef = useRef(opts.onFinal);
  onFinalRef.current = opts.onFinal;
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<SpeechError | null>(null);

  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const clearCap = () => {
    if (capRef.current) clearTimeout(capRef.current);
    capRef.current = null;
  };

  const start = () => {
    const w = typeof window !== 'undefined' ? (window as any) : {};
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    setError(null);
    setText('');
    finalRef.current = '';
    interimRef.current = '';
    erroredRef.current = false;
    cancelledRef.current = false;

    if (!Rec) {
      setError('unsupported');
      return;
    }

    const rec = new Rec();
    rec.lang = opts.lang || 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let fin = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else interim += r[0].transcript;
      }
      finalRef.current = fin.trim();
      interimRef.current = (fin + interim).trim();
      setText(interimRef.current);
    };

    rec.onerror = (e: any) => {
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
      clearCap();
      setListening(false);
      if (cancelledRef.current || erroredRef.current) return;
      const t = (finalRef.current || interimRef.current).trim();
      if (t) onFinalRef.current(t);
      else setError('no-speech');
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError('unknown');
      return;
    }

    capRef.current = setTimeout(() => rec.stop(), 20000); // 20s hard cap
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {}
  };

  const cancel = () => {
    cancelledRef.current = true;
    clearCap();
    try {
      recRef.current?.abort();
    } catch {}
    setListening(false);
    setError(null);
    setText('');
  };

  const dismiss = () => {
    setError(null);
    setText('');
  };

  return { supported, listening, text, error, start, stop, cancel, dismiss };
}

