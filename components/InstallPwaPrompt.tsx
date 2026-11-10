'use client';
import { useEffect, useState } from 'react';
import { Download, Smartphone, Share, CheckCircle2 } from 'lucide-react';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isAppleDevice);

    // Listen for Android / Chrome install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-good-bg text-good">
          <CheckCircle2 size={20} />
        </span>
        <div>
          <h4 className="text-[15px] font-semibold text-ink">App Installed</h4>
          <p className="text-[13px] text-ink2">
            Kharcha is installed on your device with offline support.
          </p>
        </div>
      </div>
    );
  }

  // Android / Desktop Chrome install button
  if (deferredPrompt) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
            <Smartphone size={20} />
          </span>
          <div>
            <h4 className="text-[15px] font-semibold text-ink">Install Kharcha App</h4>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink2">
              Add to your home screen for instant full-screen access without browser bars.
            </p>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-on-brand shadow-xs hover:opacity-95 active:scale-[0.99] transition-all"
        >
          <Download size={16} /> Install App
        </button>
      </div>
    );
  }

  // iOS Safari Guide
  if (isIos) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
            <Smartphone size={20} />
          </span>
          <div className="flex-1">
            <h4 className="text-[15px] font-semibold text-ink">Install on iPhone</h4>
            <p className="mt-0.5 text-[13px] leading-relaxed text-ink2">
              Install Kharcha on your iPhone home screen with its custom logo.
            </p>

            {showIosGuide ? (
              <div className="mt-3 rounded-xl bg-tint p-3 text-[13px] text-ink space-y-1.5 animate-in fade-in duration-200">
                <p className="flex items-center gap-1.5">
                  1. Tap the <strong>Share</strong> button <Share size={14} className="inline text-s1" /> at the bottom of Safari.
                </p>
                <p>
                  2. Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                </p>
                <p>3. Tap <strong>Add</strong> at top-right to finish.</p>
              </div>
            ) : (
              <button
                onClick={() => setShowIosGuide(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-s1 hover:underline"
              >
                How to install on iPhone &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

