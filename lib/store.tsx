'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Entry, Filter, Settings, Source, Toast } from './types';
import * as api from './api';
import { monthOf, rupees, todayIST, uid } from './format';
import { CATEGORY_META } from './meta';

const DEFAULT_SETTINGS: Settings = {
  lang: 'en-IN',
  autoSend: false,
  theme: 'system',
};

interface Store {
  entries: Entry[];
  sorted: Entry[];
  loaded: boolean;
  online: boolean;
  month: string;
  setMonth: (m: string) => void;
  serverStats: any | null;
  refreshStats: () => Promise<void>;
  add: (text: string, source: Source) => void;
  retry: (id: string) => void;
  update: (id: string, patch: Partial<Entry>) => void;
  remove: (id: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  draft: string;
  setDraft: (t: string) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  clearAll: () => void;
  reload: () => void;
}

const Ctx = createContext<Store | null>(null);

export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState(() => monthOf(todayIST()));
  const [serverStats, setServerStats] = useState<any | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [navOnline, setNavOnline] = useState(true);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const retryRef = useRef<(id: string) => void>(() => {});

  /* ---------- Toast helper ---------- */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid();
    setToasts((prev) => [...prev.slice(-1), { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, t.action ? 6500 : 4200);
  }, []);

  /* ---------- Initial load from Real Backend ---------- */
  const reload = useCallback(() => {
    setLoaded(false);
    api
      .listEntries()
      .then((es) => {
        setEntries(es);
        setLoaded(true);
      })
      .catch((err) => {
        console.warn('Initial load entries failed:', err);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  /* ---------- Reconciled Stats from Server ---------- */
  const refreshStats = useCallback(async () => {
    try {
      const stats = await api.getStats({ month });
      if (stats) setServerStats(stats);
    } catch (err) {
      console.warn('refreshStats error:', err);
    }
  }, [month]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats, entries]);

  /* ---------- Settings persistence ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('kharcha.settings');
      if (raw) setSettingsState({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    if (settings.theme === 'system') {
      el.removeAttribute('data-theme');
    } else {
      el.setAttribute('data-theme', settings.theme);
    }
  }, [settings.theme]);

  const setSettings = useCallback((p: Partial<Settings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem('kharcha.settings', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  /* ---------- Sending an entry (Optimistic Mutation) ---------- */
  const send = useCallback(
    async (e: Entry) => {
      setEntries((prev) =>
        prev.map((x) =>
          x.clientId === e.clientId
            ? { ...x, sync: 'pending', errorKind: undefined, errorMessage: undefined }
            : x
        )
      );

      try {
        const res = await api.createEntries({
          clientId: e.clientId,
          rawText: e.rawText,
          source: e.source,
        });

        // Non-transaction entered (e.g. "hello", "good morning")
        if (!res.length) {
          setEntries((prev) => prev.filter((x) => x.clientId !== e.clientId));
          toast({
            kind: 'info',
            message: 'No expense detected. Try typing "500 for coffee with cash".',
          });
          return;
        }

        const ids = res.map((r) => r.clientId);
        setEntries((prev) => {
          const idx = prev.findIndex((x) => x.clientId === e.clientId);
          if (idx < 0) return prev;
          const next = [...prev];
          next.splice(
            idx,
            1,
            ...res.map((r) => ({ ...r, sync: 'synced' as const, fresh: true }))
          );
          return next;
        });

        // Clear highlight
        setTimeout(() => {
          setEntries((prev) =>
            prev.map((x) => (ids.includes(x.clientId) ? { ...x, fresh: false } : x))
          );
        }, 1600);

        const total = res.reduce((s, r) => s + (r.amount ?? 0), 0);
        const label =
          res.length === 1 ? CATEGORY_META[res[0].category]?.label || 'Expense' : `${res.length} entries`;

        toast({
          kind: 'success',
          message: `Added ${rupees(total)} • ${label}`,
          action: {
            label: 'Undo',
            run: () => {
              setEntries((prev) => prev.filter((x) => !ids.includes(x.clientId)));
              ids.forEach((i) => api.deleteEntry(i));
            },
          },
        });
      } catch (err: any) {
        // Handle 422 MISSING_AMOUNT
        if (err instanceof api.ApiMissingAmountError) {
          // Keep a temporary entry so user can see it and edit
          const tempFailedEntry: Entry = {
            clientId: e.clientId,
            rawText: e.rawText,
            source: e.source,
            amount: null,
            type: err.extracted?.type || 'expense',
            category: err.extracted?.category || 'other',
            categoryHint: err.extracted?.categoryHint || null,
            mode: err.extracted?.mode || 'cash',
            note: err.extracted?.note || null,
            spentAt: err.extracted?.spentAt || new Date().toISOString(),
            spentOn: err.extracted?.spentOn || todayIST(),
            parseStatus: 'failed',
            createdAt: new Date().toISOString(),
            sync: 'synced',
          };

          setEntries((prev) =>
            prev.map((x) => (x.clientId === e.clientId ? tempFailedEntry : x))
          );

          // Auto-open EntrySheet pre-filled with extracted details
          setEditingId(e.clientId);

          toast({
            kind: 'warn',
            message: 'Amount was not specified. Please enter the amount.',
          });
          return;
        }

        const isNetwork = err?.kind === 'network' || !navigator.onLine;
        const msg = isNetwork
          ? 'Offline / Waiting for network'
          : err?.kind === 'ratelimit'
          ? 'Too many entries'
          : 'Server error';

        setEntries((prev) =>
          prev.map((x) =>
            x.clientId === e.clientId
              ? { ...x, sync: 'error', errorKind: err?.kind || 'server', errorMessage: msg }
              : x
          )
        );

        toast({
          kind: 'error',
          message: isNetwork
            ? 'Cannot reach the server. Your entry is saved locally and will send once reconnected.'
            : err?.message || 'Failed to save entry. Please try again.',
          action: { label: 'Retry', run: () => retryRef.current(e.clientId) },
        });
      }
    },
    [toast]
  );

  const add = useCallback(
    (rawText: string, source: Source) => {
      const now = new Date().toISOString();
      const entry: Entry = {
        clientId: uid(),
        rawText,
        source,
        amount: null,
        type: 'expense',
        category: 'other',
        mode: 'cash',
        spentAt: now,
        spentOn: todayIST(),
        parseStatus: 'ok',
        createdAt: now,
        sync: 'pending',
      };
      setEntries((prev) => [...prev, entry]);
      send(entry);
    },
    [send]
  );

  const retry = useCallback(
    (id: string) => {
      const e = entriesRef.current.find((x) => x.clientId === id);
      if (e) send(e);
    },
    [send]
  );
  retryRef.current = retry;

  /* ---------- Auto-retry when network is restored ---------- */
  useEffect(() => {
    setNavOnline(navigator.onLine);
    const handleOnline = () => {
      setNavOnline(true);
      entriesRef.current
        .filter((e) => e.sync === 'error' && e.errorKind === 'network')
        .forEach(send);
    };
    const handleOffline = () => setNavOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [send]);

  /* ---------- Edit & Delete ---------- */
  const update = useCallback((id: string, patch: Partial<Entry>) => {
    let targetMongoId: string | undefined;
    let existingEntry: Entry | undefined;

    setEntries((prev) =>
      prev.map((e) => {
        if (e.clientId === id) {
          targetMongoId = e._id;
          existingEntry = e;
          return { ...e, ...patch, parseStatus: 'manual', sync: 'synced' };
        }
        return e;
      })
    );

    const fullPatch = {
      ...patch,
      rawText: patch.rawText || existingEntry?.rawText,
      source: patch.source || existingEntry?.source,
    };

    api.updateEntry(targetMongoId || id, fullPatch).then((updated) => {
      if (updated?._id) {
        setEntries((prev) =>
          prev.map((e) => (e.clientId === id ? { ...e, _id: updated._id, sync: 'synced' } : e))
        );
      }
    });
  }, []);

  const remove = useCallback(
    (id: string) => {
      const e = entriesRef.current.find((x) => x.clientId === id);
      if (!e) return;
      setEntries((prev) => prev.filter((x) => x.clientId !== id));
      api.deleteEntry(id, e._id);
      toast({
        kind: 'info',
        message: 'Entry deleted',
        action: {
          label: 'Undo',
          run: () => {
            setEntries((prev) => [...prev, e]);
            api.restoreEntry(e.clientId, e._id);
          },
        },
      });
    },
    [toast]
  );

  const clearAll = useCallback(() => setEntries([]), []);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => (b.spentAt || '').localeCompare(a.spentAt || '')),
    [entries]
  );

  const value: Store = {
    entries,
    sorted,
    loaded,
    online: navOnline,
    month,
    setMonth,
    serverStats,
    refreshStats,
    add,
    retry,
    update,
    remove,
    editingId,
    setEditingId,
    draft,
    setDraft,
    filter,
    setFilter,
    toasts,
    toast,
    dismissToast,
    settings,
    setSettings,
    clearAll,
    reload,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

