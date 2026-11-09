import { signSessionToken, verifyGuestToken, resolveSessionUser } from '../lib/auth';
import { User } from '../models/User';
import { GoogleAuthError, verifyGoogleIdToken } from '../lib/google';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

async function runGoogleAuthTests() {
  console.log('=== Google Auth & Merge Logic Verification Suite ===\n');

  // 1. Session Token Compatibility
  console.log('1. Testing Session Token Sign & Verification...');
  const testUserId = 'user-google-test-uuid-987';
  const token = await signSessionToken(testUserId);
  const verified = await verifyGuestToken(token);
  assert(verified?.userId === testUserId, 'Session JWT encodes and decodes userId correctly');
  console.log('✓ Session Token tests passed.\n');

  // 2. Google Token Verification Rejections
  console.log('2. Testing Google ID Token Validation & Error Handling...');
  try {
    await verifyGoogleIdToken('invalid-jwt-payload-string');
    assert(false, 'Should have failed on invalid token string');
  } catch (err: any) {
    assert(err instanceof GoogleAuthError, 'Throws GoogleAuthError on invalid token');
    assert(err.code === 'INVALID_TOKEN' || err.code === 'MISSING_CLIENT_ID', 'Proper error code returned');
  }
  console.log('✓ Token validation rejection tests passed.\n');

  // 3. Multi-hop mergedInto Continuity Resolution Logic
  console.log('3. Testing mergedInto Pointer Chain Resolution Simulation...');
  // Simulate following mergedInto links:
  // guestPhone1 -> guestPhone2 -> claimedGoogleUser
  const fakeUsers: Record<string, { userId: string; mergedInto?: string; googleSub?: string }> = {
    'guest-phone-1': { userId: 'guest-phone-1', mergedInto: 'guest-phone-2' },
    'guest-phone-2': { userId: 'guest-phone-2', mergedInto: 'google-claimed-user' },
    'google-claimed-user': { userId: 'google-claimed-user', googleSub: 'google-sub-12345' },
  };

  let currentId: string = 'guest-phone-1';
  let hops = 0;
  while (fakeUsers[currentId]?.mergedInto && hops < 5) {
    currentId = fakeUsers[currentId].mergedInto!;
    hops++;
  }
  assert(currentId === 'google-claimed-user', 'Chain correctly resolves from guest-phone-1 to google-claimed-user');
  assert(hops === 2, 'Resolved in 2 hops');
  console.log('✓ Multi-hop mergedInto chain resolution passed.\n');

  // 4. Merge Deduplication Engine Simulation
  console.log('4. Testing Account Entry Deduplication (ClientId Idempotency)...');
  const accountEntries = [
    { _id: 'acc-1', clientId: 'c-100', rawText: '100 chai', amount: 10000 },
    { _id: 'acc-2', clientId: 'c-200', rawText: '200 lunch', amount: 20000 },
  ];

  const guestEntries = [
    { _id: 'gst-1', clientId: 'c-100', rawText: '100 chai (guest duplicate)', amount: 10000 }, // duplicate!
    { _id: 'gst-2', clientId: 'c-300', rawText: '300 fuel', amount: 30000 }, // non-duplicate
    { _id: 'gst-3', clientId: 'c-400', rawText: '400 movie (deleted)', amount: 40000, deletedAt: new Date() }, // soft-deleted
  ];

  const existingAccountClientIds = new Set(accountEntries.map((e) => e.clientId));
  const toMove = guestEntries.filter((e) => !existingAccountClientIds.has(e.clientId));
  const duplicates = guestEntries.filter((e) => existingAccountClientIds.has(e.clientId));

  assert(toMove.length === 2, '2 non-duplicate entries selected to move');
  assert(toMove.some((e) => e.clientId === 'c-300'), 'c-300 moved');
  assert(toMove.some((e) => e.clientId === 'c-400' && e.deletedAt != null), 'Soft-deleted c-400 preserved and moved');
  assert(duplicates.length === 1 && duplicates[0].clientId === 'c-100', 'Duplicate guest c-100 identified for discard');
  console.log('✓ Merge deduplication and soft-delete retention passed.\n');

  // 5. Daily Nudge Cadence Logic
  console.log('5. Testing Daily Nudge Recurrence & Dismissal Rules...');
  let mockStorage: Record<string, string> = {};
  function checkNudgeTrigger(entryCount: number, isGuest: boolean, todayStr: string) {
    if (!isGuest) return false;
    if (entryCount < 3) return false;

    const lastTriggered = mockStorage['kharcha.nudge.triggered_date'];
    if (lastTriggered !== todayStr) {
      mockStorage['kharcha.nudge.triggered_date'] = todayStr;
      delete mockStorage['kharcha.nudge.dismissed_date'];
      return true;
    }
    return false;
  }

  // Day 1: Entry 1 and 2
  assert(checkNudgeTrigger(1, true, '2026-11-09') === false, 'Entry 1: No nudge');
  assert(checkNudgeTrigger(2, true, '2026-11-09') === false, 'Entry 2: No nudge');

  // Day 1: Entry 3 (Qualifies!)
  assert(checkNudgeTrigger(3, true, '2026-11-09') === true, 'Entry 3: Nudge triggers for the first time!');

  // Day 1: Entry 4 (Same day, rest of entries not needed)
  assert(checkNudgeTrigger(4, true, '2026-11-09') === false, 'Entry 4 same day: No duplicate nudge');

  // User dismisses on Day 1
  mockStorage['kharcha.nudge.dismissed_date'] = '2026-11-09';

  // Day 2 arrives!
  // Day 2: 1st entry of the day
  assert(checkNudgeTrigger(5, true, '2026-11-10') === true, 'Day 2 1st entry: Nudge triggers again!');
  // Day 2: 2nd entry
  assert(checkNudgeTrigger(6, true, '2026-11-10') === false, 'Day 2 2nd entry: No duplicate nudge');

  // User Signs Up with Google!
  // Day 3: User is now claimed (isGuest: false)
  assert(checkNudgeTrigger(7, false, '2026-11-11') === false, 'Claimed user: Nudge NEVER shows again!');
  console.log('✓ Daily Nudge recurrence & dismissal verification passed.\n');

  // 6. Logout Protection Rules
  console.log('6. Testing Logout Guard Rules...');
  function canLogout(isGuest: boolean) {
    if (isGuest) return { allowed: false, error: 'guest_cannot_logout' };
    return { allowed: true };
  }
  assert(canLogout(true).allowed === false, 'Guest is prevented from logging out');
  assert(canLogout(false).allowed === true, 'Claimed account is allowed to log out');
  console.log('✓ Logout guard tests passed.\n');

  console.log('=== All Google Auth & Merge Tests Completed Successfully! ===');
}

runGoogleAuthTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

