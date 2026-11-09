'use client';
import { useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FileSpreadsheet,
  LogOut,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Table2,
  User as UserIcon,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import type { ReactNode } from 'react';
import Link from 'next/link';

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
  const { settings, setSettings, reload, toast, user, loadingUser, logout } = useStore();
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const rawId = user?.userId || '';
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

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await logout();
      setConfirmLogout(false);
    } catch (err: any) {
      toast({ kind: 'error', message: err?.message || 'Sign out failed.' });
    } finally {
      setLoggingOut(false);
    }
  };

  const isClaimed = user && !user.isGuest;

  return (
    <div className="px-5 pb-12 pt-[calc(env(safe-area-inset-top)+16px)]">
      <h1 className="text-[26px] font-bold tracking-tight text-ink">Settings</h1>

      {/* Account Section */}
      <h2 className="mb-2 mt-6 text-[16px] font-semibold text-ink">Account</h2>

      {loadingUser ? (
        <div className="skel h-36 w-full rounded-2xl" />
      ) : isClaimed ? (
        /* Signed-in Account Card */
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              {user.picture ? (
                /* Google Avatar direct from Google CDN (safe <img>) */
                <img
                  src={user.picture}
                  alt={user.name || user.email || 'Avatar'}
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-line"
                />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-ink font-bold text-lg">
                  {user.name ? user.name[0].toUpperCase() : <UserIcon size={22} />}
                </span>
              )}
              <div>
                <h3 className="text-[16px] font-semibold text-ink leading-snug">
                  {user.name || 'Google Account'}
                </h3>
                <p className="text-[13.5px] text-ink2">{user.email}</p>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-[11.5px] font-medium text-good">
                  <ShieldCheck size={13} /> Backed up to Google
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-line/60 pt-4 flex items-center justify-between">
            <span className="text-[13px] text-ink2">Switch account or sign out</span>
            {confirmLogout ? (
              <div className="flex items-center gap-2">
                <button
                  disabled={loggingOut}
                  onClick={() => setConfirmLogout(false)}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-ink2 hover:bg-tint transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={loggingOut}
                  onClick={handleSignOut}
                  className="rounded-full bg-bad/10 px-3.5 py-1.5 text-[13px] font-semibold text-bad hover:bg-bad/20 transition-colors"
                >
                  {loggingOut ? 'Signing out...' : 'Confirm Sign Out'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmLogout(true)}
                className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium text-ink2 hover:bg-tint hover:text-ink transition-colors"
              >
                <LogOut size={14} /> Sign Out
              </button>
            )}
          </div>
        </section>
      ) : (
        /* Guest User - Claim Card + Recovery Code Fallback */
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink shadow-xs">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h3 className="text-[16px] font-semibold text-ink">Save your account</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">
                  You are currently using Kharcha as a guest. Link Google in 1 tap to access your
                  expenses from any phone or browser.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-start pl-[52px]">
              <GoogleSignInButton
                theme="outline"
                shape="pill"
                size="large"
                text="continue_with"
                width={260}
              />
            </div>
          </section>

          {/* Fallback Recovery Code Card */}
          <section className="rounded-2xl border border-warn/30 bg-warn-bg/30 p-4.5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn-bg text-warn">
                <ShieldAlert size={18} />
              </span>
              <div>
                <h4 className="text-[15px] font-semibold text-ink">
                  Manual Recovery Code
                </h4>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink2">
                  If you prefer not using Google, keep this code safe to restore your entries manually.
                </p>
              </div>
            </div>

            <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-xs">
              <code className="num flex-1 text-[16px] font-bold tracking-[0.08em] text-ink">
                {showCode ? (loadingUser ? 'Loading...' : recoveryCode) : 'KHARCHA-••••-••••'}
              </code>
              <button
                aria-label={showCode ? 'Hide code' : 'Show code'}
                onClick={() => setShowCode((prev) => !prev)}
                className="grid h-8 w-8 place-items-center rounded-full text-ink2 hover:bg-tint hover:text-ink active:scale-95 transition-colors"
              >
                {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                aria-label="Copy recovery code"
                onClick={handleCopy}
                className="grid h-8 w-8 place-items-center rounded-full text-ink2 hover:bg-tint hover:text-ink active:scale-95 transition-colors"
              >
                {copied ? <Check size={16} className="text-income" /> : <Copy size={16} />}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Voice & Speech Input */}
      <h2 className="mb-2 mt-8 text-[16px] font-semibold text-ink">Voice Typing</h2>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm">
        <Row title="Language" hint="Speech recognition dialect">
          <Segmented
            value={settings.lang}
            onChange={(lang) => setSettings({ lang })}
            options={[
              { id: 'hi-IN', label: 'Hindi' },
              { id: 'en-IN', label: 'English' },
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

      {/* Privacy Policy & Data Reload */}
      <div className="mt-8 space-y-3">
        <button
          onClick={() => {
            reload();
            toast({ kind: 'info', message: 'Data refreshed from server' });
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3.5 text-[15px] font-semibold text-ink hover:bg-tint active:scale-[0.99] transition-all shadow-sm"
        >
          <RotateCcw size={16} /> Refresh Data from Server
        </button>

        <div className="text-center">
          <Link
            href="/privacy"
            className="text-[13px] text-ink2 hover:text-ink underline transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
