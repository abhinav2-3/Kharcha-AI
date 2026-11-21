import assert from 'assert';
import {
  openOfflineDB,
  saveLocalEntry,
  getPendingEntries,
  getAllLocalEntries,
  markEntrySynced,
  deleteLocalEntry,
  clearUserLocalEntries,
} from '../lib/idb';
import type { Entry } from '../lib/types';

// In-memory mock IDB implementation for automated Node verification
class MockIDBStore {
  data = new Map<string, any>();
  put(record: any) {
    this.data.set(record.clientId, record);
    const req: any = { onsuccess: null, onerror: null };
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  delete(key: string) {
    this.data.delete(key);
    const req: any = { onsuccess: null, onerror: null };
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  }
  openCursor() {
    const entries = Array.from(this.data.values());
    let idx = 0;
    const req: any = { onsuccess: null, onerror: null, result: null };
    setTimeout(() => {
      const step = () => {
        if (idx < entries.length) {
          const item = entries[idx++];
          req.result = {
            value: item,
            continue: () => step(),
            delete: () => this.data.delete(item.clientId),
          };
          if (req.onsuccess) req.onsuccess({ target: req });
        } else {
          req.result = null;
          if (req.onsuccess) req.onsuccess({ target: req });
        }
      };
      step();
    }, 0);
    return req;
  }
}

class MockIDBDatabase {
  objectStoreNames = { contains: () => true };
  store = new MockIDBStore();
  transaction() {
    const s = this.store;
    const tx: any = {
      objectStore: () => s,
      oncomplete: null,
      onerror: null,
    };
    setTimeout(() => {
      if (tx.oncomplete) tx.oncomplete();
    }, 0);
    return tx;
  }
}

const mockDb = new MockIDBDatabase();
const mockFactory: any = {
  open: () => {
    const req: any = { onsuccess: null, onerror: null, onupgradeneeded: null };
    setTimeout(() => {
      req.result = mockDb;
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 0);
    return req;
  },
};

async function runTests() {
  console.log('Testing lib/idb.ts operations...');

  const sampleEntry: Entry = {
    clientId: 'test-client-1',
    rawText: '500 chai pe cash se',
    source: 'voice',
    amount: 50000,
    type: 'expense',
    category: 'food',
    mode: 'cash',
    spentAt: new Date().toISOString(),
    spentOn: '2026-11-21',
    parseStatus: 'ok',
    createdAt: new Date().toISOString(),
    sync: 'pending',
  };

  // 1. Save entry
  await saveLocalEntry(sampleEntry, 'user-1', mockFactory);
  console.log('✓ saveLocalEntry passed');

  // 2. Query pending entries
  const pending = await getPendingEntries('user-1', mockFactory);
  assert.strictEqual(pending.length, 1, 'Should have 1 pending entry');
  assert.strictEqual(pending[0].clientId, 'test-client-1');
  console.log('✓ getPendingEntries passed');

  // 3. Mark entry synced
  const serverVersion: Entry = {
    ...sampleEntry,
    _id: 'mongo-id-999',
    category: 'food',
    mode: 'cash',
  };
  await markEntrySynced('test-client-1', serverVersion, 'user-1', mockFactory);
  const pendingAfter = await getPendingEntries('user-1', mockFactory);
  assert.strictEqual(pendingAfter.length, 0, 'Should have 0 pending entries after sync');
  console.log('✓ markEntrySynced passed');

  // 4. Get all entries
  const all = await getAllLocalEntries('user-1', mockFactory);
  assert.strictEqual(all.length, 1, 'Should return 1 synced entry');
  assert.strictEqual(all[0].sync, 'synced');
  assert.strictEqual(all[0]._id, 'mongo-id-999');
  console.log('✓ getAllLocalEntries passed');

  // 5. Clear entries on user logout
  await clearUserLocalEntries('user-1', mockFactory);
  const empty = await getAllLocalEntries('user-1', mockFactory);
  assert.strictEqual(empty.length, 0, 'Entries should be cleared for user');
  console.log('✓ clearUserLocalEntries passed');

  console.log('\nAll IndexedDB unit tests passed successfully!\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
