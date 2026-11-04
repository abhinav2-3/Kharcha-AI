'use client';
import { WifiOff } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function OfflineBanner() {
  const { online } = useStore();
  if (online) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warn-bg px-4 py-2 text-[13px] font-medium text-warn"
    >
      <WifiOff size={15} />
      <span>You are offline. Entries will sync when back online.</span>
    </div>
  );
}

