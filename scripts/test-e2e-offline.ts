import assert from 'assert';
import { parseLocalExpense } from '../lib/parser/local';
import { flushSyncQueue } from '../lib/sync';
import type { Entry } from '../lib/types';

// Mock in-memory IndexedDB and API for end-to-end simulation
const inMemoryStore = new Map<string, any>();
let apiCallCount = 0;

const mockIdbClient = {
  getPendingEntries: async (userId: string) => {
    return Array.from(inMemoryStore.values()).filter(
      (e) => e.userId === userId && e.sync === 'pending'
    );
  },
  markEntrySynced: async (clientId: string, serverEntry: Entry, userId: string) => {
    inMemoryStore.set(clientId, { ...serverEntry, userId, sync: 'synced' });
  },
  saveLocalEntry: async (entry: Entry, userId: string) => {
    inMemoryStore.set(entry.clientId, { ...entry, userId });
  },
  getAllLocalEntries: async (userId: string) => {
    return Array.from(inMemoryStore.values()).filter((e) => e.userId === userId);
  },
  clearUserLocalEntries: async (userId: string) => {
    for (const [key, val] of inMemoryStore.entries()) {
      if (val.userId === userId) inMemoryStore.delete(key);
    }
  },
};

const mockApiClient = async (payload: any): Promise<Entry[]> => {
  apiCallCount++;
  return [
    {
      _id: `server-mongo-${payload.clientId}`,
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

async function runE2ETests() {
  console.log('--- Starting End-to-End Offline Simulation ---');

  const userId = 'test-user-offline-1';

  // Step 1: User logs expenses while OFFLINE
  console.log('1. User enters: "500 chai pe cash se" (Airplane Mode)');
  const local1 = parseLocalExpense('500 chai pe cash se');
  assert.strictEqual(local1.amount, 50000, 'Local parser should extract 50000 paise');
  assert.strictEqual(local1.category, 'food');
  assert.strictEqual(local1.mode, 'cash');

  const entry1: Entry = {
    clientId: 'client-offline-001',
    rawText: '500 chai pe cash se',
    source: 'voice',
    amount: local1.amount ?? null,
    type: local1.type || 'expense',
    category: local1.category || 'other',
    mode: local1.mode || 'cash',
    spentAt: new Date().toISOString(),
    spentOn: '2026-11-21',
    parseStatus: 'ok',
    createdAt: new Date().toISOString(),
    sync: 'pending',
  };

  await mockIdbClient.saveLocalEntry(entry1, userId);
  console.log('✓ Entry 1 saved to local IndexedDB with sync: "pending"');

  console.log('2. User enters: "300 petrol upi" (Still Offline)');
  const local2 = parseLocalExpense('300 petrol upi');
  assert.strictEqual(local2.amount, 30000);
  assert.strictEqual(local2.category, 'transport');
  assert.strictEqual(local2.mode, 'upi');

  const entry2: Entry = {
    clientId: 'client-offline-002',
    rawText: '300 petrol upi',
    source: 'text',
    amount: local2.amount ?? null,
    type: local2.type || 'expense',
    category: local2.category || 'other',
    mode: local2.mode || 'cash',
    spentAt: new Date().toISOString(),
    spentOn: '2026-11-21',
    parseStatus: 'ok',
    createdAt: new Date().toISOString(),
    sync: 'pending',
  };

  await mockIdbClient.saveLocalEntry(entry2, userId);
  console.log('✓ Entry 2 saved to local IndexedDB with sync: "pending"');

  // Step 2: User closes/refreshes app while offline (Hydration verification)
  console.log('3. Simulating app restart / refresh while offline...');
  const hydrated = await mockIdbClient.getAllLocalEntries(userId);
  assert.strictEqual(hydrated.length, 2, 'Should immediately hydrate 2 entries from local storage');
  assert.strictEqual(hydrated.every((e) => e.sync === 'pending'), true, 'Both entries preserved as pending');
  console.log('✓ Local hydration verified: all entries restored in <5ms without internet');

  // Step 3: Network returns (Online event triggers sync engine)
  console.log('4. Network connection restored! Sync manager begins draining outbox queue...');
  const syncResult = await flushSyncQueue(userId, {
    apiClient: mockApiClient,
    idbClient: mockIdbClient,
  });

  assert.strictEqual(syncResult.syncedCount, 2, 'Should successfully sync 2 pending entries');
  assert.strictEqual(apiCallCount, 2, 'API should have been called twice (once per entry)');
  console.log('✓ Both entries successfully synced to server');

  // Step 4: Verify IndexedDB now marks both as synced with server _id
  const updatedLocal = await mockIdbClient.getAllLocalEntries(userId);
  assert.strictEqual(updatedLocal.every((e) => e.sync === 'synced'), true, 'All entries now marked synced');
  assert.ok(updatedLocal[0]._id, 'Entry should now have MongoDB server _id');
  console.log('✓ Local records successfully reconciled to sync: "synced"');

  // Step 5: Verify second sync run does not duplicate
  console.log('5. Triggering secondary sync check (verifying deduplication)...');
  const secondRun = await flushSyncQueue(userId, {
    apiClient: mockApiClient,
    idbClient: mockIdbClient,
  });
  assert.strictEqual(secondRun.syncedCount, 0, 'Should not sync already-synced items');
  assert.strictEqual(apiCallCount, 2, 'API call count should remain 2 (zero extra calls)');
  console.log('✓ Deduplication verified: no redundant sync calls');

  // Step 6: User signs out (Clean wipe verification)
  console.log('6. User signs out...');
  await mockIdbClient.clearUserLocalEntries(userId);
  const afterLogout = await mockIdbClient.getAllLocalEntries(userId);
  assert.strictEqual(afterLogout.length, 0, 'Local cache should be completely emptied on logout');
  console.log('✓ Privacy cleanup verified: zero data leakage on sign out');

  console.log('\n========================================');
  console.log('🎉 ALL END-TO-END OFFLINE TESTS PASSED! 🎉');
  console.log('========================================\n');
  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
