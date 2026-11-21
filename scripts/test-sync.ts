import assert from 'assert';
import { flushSyncQueue, isSyncingQueue } from '../lib/sync';
import type { Entry } from '../lib/types';

// Mock dependencies
const mockDB: Entry[] = [];
let createEntriesCalls = 0;

const mockApiCreateEntries = async (payload: any): Promise<Entry[]> => {
  createEntriesCalls++;
  return [
    {
      _id: `server-${payload.clientId}`,
      clientId: payload.clientId,
      rawText: payload.rawText,
      source: payload.source,
      amount: 50000,
      type: 'expense',
      category: 'food',
      mode: 'cash',
      spentAt: new Date().toISOString(),
      spentOn: '2026-11-21',
      parseStatus: 'ok',
      createdAt: new Date().toISOString(),
      sync: 'synced',
    },
  ];
};

const mockIdbMethods = {
  getPendingEntries: async (userId: string) => mockDB.filter((e) => e.sync === 'pending'),
  markEntrySynced: async (clientId: string, serverEntry: Entry, userId: string) => {
    const idx = mockDB.findIndex((e) => e.clientId === clientId);
    if (idx >= 0) {
      mockDB[idx] = { ...serverEntry, sync: 'synced' };
    }
  },
};

async function runTests() {
  console.log('Testing lib/sync.ts (Background Sync Engine)...');

  // Seed 2 pending entries
  mockDB.push(
    {
      clientId: 'c1',
      rawText: '500 chai',
      source: 'text',
      amount: 50000,
      type: 'expense',
      category: 'food',
      mode: 'cash',
      spentAt: new Date().toISOString(),
      spentOn: '2026-11-21',
      parseStatus: 'ok',
      createdAt: new Date().toISOString(),
      sync: 'pending',
    },
    {
      clientId: 'c2',
      rawText: '300 petrol',
      source: 'text',
      amount: 30000,
      type: 'expense',
      category: 'transport',
      mode: 'upi',
      spentAt: new Date().toISOString(),
      spentOn: '2026-11-21',
      parseStatus: 'ok',
      createdAt: new Date().toISOString(),
      sync: 'pending',
    }
  );

  const syncedItems: Entry[] = [];
  const result = await flushSyncQueue('user-1', {
    apiClient: mockApiCreateEntries,
    idbClient: mockIdbMethods,
    onEntrySynced: (entry) => syncedItems.push(entry),
  });

  assert.strictEqual(result.syncedCount, 2, 'Should sync 2 entries');
  assert.strictEqual(createEntriesCalls, 2, 'Should call createEntries twice');
  assert.strictEqual(mockDB.every((e) => e.sync === 'synced'), true, 'All entries in DB should be marked synced');
  assert.strictEqual(syncedItems.length, 2, 'onEntrySynced should be called for both items');
  console.log('✓ Flush sync queue processed 2 pending entries successfully');

  // Verify second run does nothing (queue is empty)
  const result2 = await flushSyncQueue('user-1', {
    apiClient: mockApiCreateEntries,
    idbClient: mockIdbMethods,
  });
  assert.strictEqual(result2.syncedCount, 0, 'Second run should sync 0 entries');
  console.log('✓ Second flush safely skipped already synced entries');

  console.log('\nAll Background Sync Engine tests passed!\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
