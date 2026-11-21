import { getPendingEntries, markEntrySynced } from './idb';
import { createEntries } from './api';
import type { Entry } from './types';

let isSyncing = false;

export interface SyncOptions {
  apiClient?: typeof createEntries;
  idbClient?: {
    getPendingEntries: typeof getPendingEntries;
    markEntrySynced: typeof markEntrySynced;
  };
  onEntrySynced?: (updated: Entry) => void;
  onSyncError?: (error: any, failedEntry: Entry) => void;
}

export function isSyncingQueue(): boolean {
  return isSyncing;
}

/**
 * Drains all pending offline entries from IndexedDB and synchronizes them with the backend.
 * Uses mutex lock to guarantee that parallel executions never duplicate work.
 */
export async function flushSyncQueue(
  userId: string,
  options?: SyncOptions
): Promise<{ syncedCount: number; errorsCount: number }> {
  if (isSyncing) {
    return { syncedCount: 0, errorsCount: 0 };
  }

  // If in browser and navigator explicitly says offline, don't attempt network requests
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { syncedCount: 0, errorsCount: 0 };
  }

  isSyncing = true;
  let syncedCount = 0;
  let errorsCount = 0;

  const idb = options?.idbClient || { getPendingEntries, markEntrySynced };
  const api = options?.apiClient || createEntries;

  try {
    const pending = await idb.getPendingEntries(userId);
    if (!pending || pending.length === 0) {
      return { syncedCount: 0, errorsCount: 0 };
    }

    // Process sequentially in order of creation to preserve transaction timeline
    for (const entry of pending) {
      try {
        const results = await api({
          clientId: entry.clientId,
          rawText: entry.rawText,
          source: entry.source,
        });

        if (results && results.length > 0) {
          const serverEntry = results[0];
          await idb.markEntrySynced(entry.clientId, serverEntry, userId);
          syncedCount++;
          if (options?.onEntrySynced) {
            options.onEntrySynced(serverEntry);
          }
        }
      } catch (err: any) {
        errorsCount++;
        console.warn(`Background sync failed for clientId ${entry.clientId}:`, err?.message || err);

        if (options?.onSyncError) {
          options.onSyncError(err, entry);
        }

        // If rate limited or network dropped completely, pause queue processing
        if (err?.kind === 'ratelimit' || err?.kind === 'network' || err?.status === 429) {
          break;
        }
      }
    }
  } catch (err) {
    console.warn('flushSyncQueue encountered unexpected error:', err);
  } finally {
    isSyncing = false;
  }

  return { syncedCount, errorsCount };
}

/**
 * Initializes listeners for online/reconnection events and periodic queue flushing.
 * Returns an unsubscribe cleanup function.
 */
export function initSyncListeners(
  userId: string,
  onEntrySynced?: (updated: Entry) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    flushSyncQueue(userId, { onEntrySynced });
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      flushSyncQueue(userId, { onEntrySynced });
    }
  };

  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibility);

  // Heartbeat check every 25 seconds
  const intervalId = setInterval(() => {
    if (navigator.onLine) {
      flushSyncQueue(userId, { onEntrySynced });
    }
  }, 25000);

  // Initial check on load
  if (navigator.onLine) {
    setTimeout(() => {
      flushSyncQueue(userId, { onEntrySynced });
    }, 1000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(intervalId);
  };
}
