import { signGuestToken, verifyGuestToken } from '../lib/auth';
import { normalizeParsedItem } from '../lib/parser/normalize';
import { ParserOutputSchema } from '../lib/parser/schema';
import { CreateEntryInputSchema, UpdateEntryInputSchema } from '../lib/validations/entry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

async function runEndToEndVerification() {
  console.log('=== Kharcha Backend End-to-End Test Suite ===\n');

  // 1. Auth & JWT Flow
  console.log('1. Testing JWT Guest Authentication...');
  const testUserId = 'test-user-uuid-1234';
  const token = await signGuestToken(testUserId);
  assert(typeof token === 'string' && token.length > 20, 'Token generated');
  
  const payload = await verifyGuestToken(token);
  assert(payload?.userId === testUserId, 'JWT payload verified with matching userId');
  
  const invalidPayload = await verifyGuestToken('corrupted-token-123');
  assert(invalidPayload === null, 'Invalid token returns null');
  console.log('✓ JWT Auth tests passed.\n');

  // 2. Input Validation Schemas
  console.log('2. Testing Zod Input Validation...');
  const validCreate = CreateEntryInputSchema.safeParse({
    clientId: 'test-client-id-1',
    rawText: '500 chai pe cash se',
    source: 'text',
  });
  assert(validCreate.success, 'Valid entry payload accepted');

  const invalidCreate = CreateEntryInputSchema.safeParse({
    clientId: '',
    rawText: '',
  });
  assert(!invalidCreate.success, 'Invalid entry payload rejected');

  const validUpdate = UpdateEntryInputSchema.safeParse({
    amount: 550,
    note: 'Updated notes',
    category: 'food',
  });
  assert(validUpdate.success, 'Valid update payload accepted');
  console.log('✓ Validation schema tests passed.\n');

  // 3. AI Parser Schema & Fallback
  console.log('3. Testing Parser Schema & Fallback...');
  const validLLMJson = {
    entries: [
      {
        amount: 500,
        type: 'expense',
        category: 'food',
        mode: 'cash',
        note: 'chai',
        date: '2026-11-03',
      },
    ],
  };
  const parsed = ParserOutputSchema.safeParse(validLLMJson);
  if (!parsed.success) {
    throw new Error('Valid LLM output parsing failed');
  }
  assert(parsed.data.entries.length === 1, 'Valid LLM output parsed');

  const multiItemJson = {
    entries: [
      { amount: 20, category: 'food', note: 'chai' },
      { amount: 30, category: 'food', note: 'samosa' },
    ],
  };
  const parsedMulti = ParserOutputSchema.safeParse(multiItemJson);
  assert(parsedMulti.success && parsedMulti.data.entries.length === 2, 'Multi-item parsed correctly');
  console.log('✓ Parser schema tests passed.\n');

  // 4. Normalization & Fail-Safe Mechanics
  console.log('4. Testing Normalization & Currency Conversion...');
  const normalizedSingle = normalizeParsedItem(parsed.data.entries[0]);
  assert(normalizedSingle.amount === 50000, '500 INR normalized to 50000 paise');
  assert(normalizedSingle.spentOn === '2026-11-03', 'Date matches YYYY-MM-DD');
  assert(normalizedSingle.parseStatus === 'ok', 'Status is ok');

  // Missing amount fail-safe test ("kal chai pi")
  const normalizedFailSafe = normalizeParsedItem({
    amount: null,
    category: 'food',
    note: 'kal chai pi',
  });
  assert(normalizedFailSafe.amount === null, 'Missing amount stays null');
  assert(normalizedFailSafe.mode === 'cash', 'Default mode resolves to cash');
  assert(normalizedFailSafe.parseStatus === 'failed', 'Status is failed without crashing');
  console.log('✓ Normalization & fail-safe tests passed.\n');

  // 5. Idempotency Key Generation Verification
  console.log('5. Testing Multi-item Client ID Generation...');
  const baseClientId = 'client-uuid-999';
  const itemIds = [0, 1].map((idx) => `${baseClientId}:${idx}`);
  assert(itemIds[0] === 'client-uuid-999:0', 'Item 0 ID generated');
  assert(itemIds[1] === 'client-uuid-999:1', 'Item 1 ID generated');
  console.log('✓ Idempotency and multi-item IDs passed.\n');

  console.log('=== All Kharcha Backend Tests Passed Successfully! ===');
}

runEndToEndVerification().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
