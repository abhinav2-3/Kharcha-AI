'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { AlertCircle, Globe, Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  shape?: 'pill' | 'rectangular';
  width?: string | number;
  className?: string;
  onSuccess?: () => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleSignInButton({
  theme = 'outline',
  size = 'large',
  text = 'continue_with',
  shape = 'pill',
  width = 280,
  className = '',
  onSuccess,
}: GoogleSignInButtonProps) {
  const { user, loginGoogle, toast, online } = useStore();
  const btnContainerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  const clientId =
    user?.googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  // Detect embedded WebViews (e.g. Instagram, WhatsApp, Facebook) where Google GIS blocks popups
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent || navigator.vendor || '';
    const isWebview =
      /FBAN|FBAV|Instagram|WhatsApp|Line|Snapchat|MicroMessenger/i.test(ua);
    setIsInAppBrowser(isWebview);
  }, []);

  // Dynamically inject Google Identity Services script
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-gsi-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.warn('Failed to load Google Identity Services SDK.');
    };
    document.head.appendChild(script);
  }, []);

  // Initialize and render the standard Google button
  useEffect(() => {
    if (!scriptLoaded || !clientId || !window.google?.accounts?.id || !btnContainerRef.current) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          if (!response?.credential) return;
          setAuthenticating(true);
          try {
            await loginGoogle(response.credential);
            onSuccess?.();
          } catch (err: any) {
            toast({
              kind: 'error',
              message: err?.message || 'Google sign-in failed. Please retry.',
            });
          } finally {
            setAuthenticating(false);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Clear container and render button
      btnContainerRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(btnContainerRef.current, {
        type: 'standard',
        theme,
        size,
        text,
        shape,
        logo_alignment: 'left',
        width: typeof width === 'number' ? `${width}` : width,
      });
    } catch (err) {
      console.warn('Error rendering Google Sign-In button:', err);
    }
  }, [scriptLoaded, clientId, theme, size, text, shape, width, loginGoogle, onSuccess, toast]);

  if (isInAppBrowser) {
    return (
      <div className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-warn-bg/50 border border-warn/30 text-center max-w-sm">
        <div className="flex items-center gap-2 text-warn text-[13px] font-medium">
          <Globe size={16} /> Open in Chrome or Safari
        </div>
        <p className="text-[12px] text-ink2 leading-tight">
          Google sign-in is restricted in in-app browsers. Tap ⋯ in the menu to open in your browser.
        </p>
      </div>
    );
  }

  if (!online) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-line bg-surface/50 text-[13px] text-ink2 max-w-[280px]">
        <AlertCircle size={15} /> Internet required to sign in
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Loading / Authenticating Overlay */}
      {authenticating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-surface/85 backdrop-blur-xs">
          <Loader2 size={18} className="animate-spin text-ink" />
          <span className="ml-2 text-[13px] font-medium text-ink">Signing in...</span>
        </div>
      )}

      {/* Skeleton placeholder while GIS script or Client ID is loading */}
      {(!scriptLoaded || !clientId) && (
        <div
          style={{ width: typeof width === 'number' ? `${width}px` : width, height: 40 }}
          className="skel rounded-full border border-line animate-pulse"
        />
      )}

      {/* Real Google GIS Button container */}
      <div
        ref={btnContainerRef}
        style={{
          display: scriptLoaded && clientId ? 'block' : 'none',
          minHeight: 40,
        }}
      />
    </div>
  );
}

