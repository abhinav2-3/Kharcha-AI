'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import BottomNav from './BottomNav';
import Composer from './Composer';
import EntrySheet from './EntrySheet';
import OfflineBanner from './OfflineBanner';
import Toasts from './Toasts';

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const showComposer = path !== '/settings';

  return (
    <div className="app relative mx-auto min-h-dvh w-full max-w-[430px] bg-bg shadow-2xl">
      <OfflineBanner />
      <Toasts />
      <main
        className={
          showComposer
            ? 'pb-[calc(168px+env(safe-area-inset-bottom))]'
            : 'pb-[calc(96px+env(safe-area-inset-bottom))]'
        }
      >
        {children}
      </main>
      {showComposer && <Composer />}
      <BottomNav />
      <EntrySheet />
    </div>
  );
}

