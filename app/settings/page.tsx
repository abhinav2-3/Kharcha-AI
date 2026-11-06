'use client';
import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileSpreadsheet,
  RotateCcw,
  ShieldAlert,
  Table2,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { fetchMe } from '@/lib/api';
import type { ReactNode } from 'react';

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        {hint && <span className="block text-[13px] text-ink2">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex rounded-full bg-tint p-1">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3.5 py-1 text-[13px] font-semibold transition-all ${
              on ? 'bg-surface text-ink shadow-sm' : 'text-ink2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const { settings, setSettings, reload, toast } = useStore();
  const [profile, setProfile] = useState<{ userId: string } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetchMe().then((p) => {
      if (active) {
        setProfile(p);
        setLoadingProfile(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Format recovery code: KHARCHA-<first 8 chars of userId in uppercase>
  const rawId = profile?.userId || '';
  const cleanIdPart = rawId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const recoveryCode = rawId ? `KHARCHA-${cleanIdPart}` : 'KHARCHA-INITIAL';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      toast({ kind: 'success', message: 'Recovery code copied to clipboard!' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ kind: 'error', message: 'Could not copy automatically. Please copy manually.' });
    }
  };

  return (
    <div className="px-5 pb-8 pt-[calc(env(safe-area-inset-top)+16px)]">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">Settings</h1>

      {/* Account Recovery Card */}
      <section className="mt-6 rounded-2xl border border-warn/30 bg-warn-bg/40 p-4.5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-bg text-warn">
            <ShieldAlert size={20} />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-ink">
              Save your recovery code
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">
              Your expenses are tied to this browser session. If you switch devices or clear
              browser history, this code restores your data.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
          <code className="num flex-1 text-[17px] font-bold tracking-[0.08em] text-ink">
            {showCode ? (loadingProfile ? 'Loading...' : recoveryCode) : 'KHARCHA-••••-••••'}
          </code>
          <button
            aria-label={showCode ? 'Hide code' : 'Show code'}
            onClick={() => setShowCode((prev) => !prev)}
            className="grid h-9 w-9 place-items-center rounded-full text-ink2 hover:bg-tint hover:text-ink active:scale-95 transition-colors"
          >
            {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button
            aria-label="Copy recovery code"
            onClick={handleCopy}
            className="grid h-9 w-9 place-items-center rounded-full text-ink2 hover:bg-tint hover:text-ink active:scale-95 transition-colors"
          >
            {copied ? <Check size={18} className="text-income" /> : <Copy size={18} />}
          </button>
        </div>
      </section>

      {/* Voice & Speech Input */}
      <h2 className="mb-2 mt-8 text-[16px] font-semibold text-ink">Voice Typing</h2>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm">
        <Row title="Language" hint="Speech recognition dialect">
          <Segmented
            value={settings.lang}
            onChange={(lang) => setSettings({ lang })}
            options={[
              { id: 'en-IN', label: 'English (IN)' },
              { id: 'en-US', label: 'English (US)' },
            ]}
          />
        </Row>
        <Row title="Instant submit" hint="Save entry immediately after speaking">
          <button
            role="switch"
            aria-checked={settings.autoSend}
            aria-label="Send after speaking"
            onClick={() => setSettings({ autoSend: !settings.autoSend })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.autoSend ? 'bg-s1' : 'bg-line'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                settings.autoSend ? 'left-5.5' : 'left-0.5'
              }`}
            />
          </button>
        </Row>
      </div>

      {/* Appearance */}
      <h2 className="mb-2 mt-8 text-[16px] font-semibold text-ink">Appearance</h2>
      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        <Row title="Theme">
          <Segmented
            value={settings.theme}
            onChange={(theme) => setSettings({ theme })}
            options={[
              { id: 'system', label: 'Auto' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
      </div>

      {/* Backup & Export */}
      <h2 className="mb-2 mt-8 text-[16px] font-semibold text-ink">Backup & Export</h2>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm">
        <Row title="Export to Excel / CSV" hint="Download all logged entries">
          <span className="flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-[13px] font-medium text-ink2">
            <Table2 size={14} /> Coming Soon
          </span>
        </Row>
        <Row title="Google Sheets Sync" hint="Synchronize entries to a personal sheet">
          <span className="flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 text-[13px] font-medium text-ink2">
            <FileSpreadsheet size={14} /> Coming Soon
          </span>
        </Row>
      </div>

      {/* Data Reload */}
      <div className="mt-8">
        <button
          onClick={() => {
            reload();
            toast({ kind: 'info', message: 'Data refreshed from server' });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5 text-[15px] font-semibold text-ink hover:bg-tint active:scale-[0.99] transition-all shadow-sm"
        >
          <RotateCcw size={16} /> Refresh Data from Server
        </button>
      </div>
    </div>
  );
}

