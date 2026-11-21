import type { Entry } from './types';

const DB_NAME = 'kharcha_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

export interface LocalStoredEntry extends Entry {
  userId: string;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getIDBFactory(): IDBFactory | null {
  if (typeof window === 'undefined') return null;
  return (
    window.indexedDB ||
    (window as any).mozIndexedDB ||
    (window as any).webkitIndexedDB ||
    (window as any).msIndexedDB ||
    null
  );
}

/**
 * Initializes and returns the IndexedDB instance with typed schema and indexes.
 */
export function openOfflineDB(customFactory?: IDBFactory): Promise<IDBDatabase | null> {
  const factory = customFactory || getIDBFactory();
  if (!factory) return Promise.resolve(null);

  if (dbPromise && !customFactory) return dbPromise;

  const promise = new Promise<IDBDatabase | null>((resolve, reject) => {
    try {
      const request = factory.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'clientId' });
          store.createIndex('sync', 'sync', { unique: false });
          store.createIndex('spentOn', 'spentOn', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('user_sync', ['userId', 'sync'], { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event: Event) => {
        console.warn('Failed to open offline IndexedDB:', (event.target as IDBOpenDBRequest).error);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('Offline IndexedDB upgrade blocked by an open connection in another tab.');
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization error:', err);
      resolve(null);
    }
  });

  if (!customFactory) {
    dbPromise = promise;
  }
  return promise;
}

/**
 * Saves a single entry locally in IndexedDB.
 */
export async function saveLocalEntry(
  entry: Entry,
  userId: string,
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openOfflineDB(customFactory);
  if (!db) return;

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: LocalStoredEntry = {
        ...entry,
        userId: userId || 'guest',
        sync: entry.sync || 'pending',
      };
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    } catch (err) {
      console.warn('saveLocalEntry failed:', err);
      resolve(); // Do not crash the app if IndexedDB is disabled
    }
  });
}

/**
 * Bulk saves entries into IndexedDB (e.g. after fetching from backend or seeding).
 */
export async function saveLocalEntries(
  entries: Entry[],
  userId: string,
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openOfflineDB(customFactory);
  if (!db || !entries.length) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      entries.forEach((entry) => {
        const record: LocalStoredEntry = {
          ...entry,
          userId: userId || 'guest',
          sync: entry.sync || 'synced',
        };
        store.put(record);
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (err) {
      console.warn('saveLocalEntries failed:', err);
      resolve();
    }
  });
}

/**
 * Retrieves all pending entries that need to be synchronized with MongoDB.
 */
export async function getPendingEntries(
  userId: string,
  customFactory?: IDBFactory
): Promise<Entry[]> {
  const db = await openOfflineDB(customFactory);
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const targetUser = userId || 'guest';

      const results: Entry[] = [];
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as LocalStoredEntry;
          if (val.userId === targetUser && val.sync === 'pending') {
            results.push(val);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      req.onerror = () => resolve([]);
    } catch (err) {
      console.warn('getPendingEntries failed:', err);
      resolve([]);
    }
  });
}

/**
 * Loads all local entries for a specific user from IndexedDB (instant offline startup).
 */
export async function getAllLocalEntries(
  userId: string,
  customFactory?: IDBFactory
): Promise<Entry[]> {
  const db = await openOfflineDB(customFactory);
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const targetUser = userId || 'guest';

      const results: Entry[] = [];
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as LocalStoredEntry;
          if (val.userId === targetUser) {
            results.push(val);
          }
          cursor.continue();
        } else {
          // Sort by spentAt desc
          results.sort((a, b) => new Date(b.spentAt).getTime() - new Date(a.spentAt).getTime());
          resolve(results);
        }
      };

      req.onerror = () => resolve([]);
    } catch (err) {
      console.warn('getAllLocalEntries failed:', err);
      resolve([]);
    }
  });
}

/**
 * Marks a pending local entry as successfully synced with the server's authoritative record.
 */
export async function markEntrySynced(
  clientId: string,
  serverEntry: Entry,
  userId: string,
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openOfflineDB(customFactory);
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: LocalStoredEntry = {
        ...serverEntry,
        clientId,
        userId: userId || 'guest',
        sync: 'synced',
      };
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch (err) {
      console.warn('markEntrySynced failed:', err);
      resolve();
    }
  });
}

/**
 * Deletes an entry locally (e.g. user deleted an entry).
 */
export async function deleteLocalEntry(
  clientId: string,
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openOfflineDB(customFactory);
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(clientId);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch (err) {
      console.warn('deleteLocalEntry failed:', err);
      resolve();
    }
  });
}

/**
 * Clears all local entries for a specific user (on logout or account switch).
 */
export async function clearUserLocalEntries(
  userId: string,
  customFactory?: IDBFactory
): Promise<void> {
  const db = await openOfflineDB(customFactory);
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const targetUser = userId || 'guest';
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const val = cursor.value as LocalStoredEntry;
          if (val.userId === targetUser) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      req.onerror = () => resolve();
    } catch (err) {
      console.warn('clearUserLocalEntries failed:', err);
      resolve();
    }
  });
}
