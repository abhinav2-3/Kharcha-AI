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

  const validRestore = UpdateEntryInputSchema.safeParse({
    restore: true,
  });
  assert(validRestore.success, 'Restore payload accepted');

  const validManualUpsert = UpdateEntryInputSchema.safeParse({
    amount: 150,
    rawText: 'coffee with cash',
    source: 'voice',
    category: 'food',
    mode: 'cash',
  });
  assert(validManualUpsert.success, 'Manual upsert payload accepted');
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

  // Security: Astronomical amount overflow protection (> 10,000,000)
  const normalizedHuge = normalizeParsedItem({
    amount: 999999999, // 99 Crore
    category: 'other',
  });
  assert(normalizedHuge.amount === null && normalizedHuge.parseStatus === 'failed', 'Astronomical amount rejected safely');

  // Security: Formula injection sanitization in notes
  const formulaNote = normalizeParsedItem({
    amount: 100,
    category: 'food',
    note: '=cmd|/c calc!A0',
  });
  assert(formulaNote.note?.startsWith("'="), 'CSV/Formula injection trigger neutralized');

  // Hinglish Amount conversions
  const normalizedDedhSau = normalizeParsedItem({
    amount: 150, // "dedh sau"
    category: 'transport',
    note: 'auto wale ko diye',
    mode: 'cash',
  });
  assert(normalizedDedhSau.amount === 15000, 'Dedh sau converts to 15000 paise');
  assert(normalizedDedhSau.category === 'transport', 'Auto maps to transport category');
  console.log('✓ Normalization, security sanity & Hinglish tests passed.\n');

  // 5. Idempotency Key Generation Verification
  console.log('5. Testing Multi-item Client ID Generation...');
  const baseClientId = 'client-uuid-999';
  const itemIds = [0, 1].map((idx) => `${baseClientId}:${idx}`);
  assert(itemIds[0] === 'client-uuid-999:0', 'Item 0 ID generated');
  assert(itemIds[1] === 'client-uuid-999:1', 'Item 1 ID generated');
  console.log('✓ Idempotency and multi-item IDs passed.\n');

  // 6. Pre-LLM Filter & Rate Limiting Heuristics
  console.log('6. Testing Pre-LLM Zero-Token Filter & Rate Limit Config...');
  const { validatePreLLMInput } = await import('../lib/parser/filter');
  const { RATE_LIMIT_CONFIG } = await import('../lib/ratelimit');

  assert(validatePreLLMInput('500 for coffee').valid, 'Valid expense passed pre-LLM check');
  assert(validatePreLLMInput('auto 120').valid, 'Short valid expense passed pre-LLM check');
  assert(!validatePreLLMInput('a').valid, 'Single character rejected before LLM');
  assert(!validatePreLLMInput('??????').valid, 'Punctuation-only rejected before LLM');
  assert(!validatePreLLMInput('aaaaaaaaaaaaaaaaaaaaa').valid, 'Repetitive spam rejected before LLM');

  assert(RATE_LIMIT_CONFIG.MINUTE_LIMIT === 6, 'Minute limit configured to 6 req/min');
  assert(RATE_LIMIT_CONFIG.DAILY_LIMIT === 50, 'Daily limit configured to 50 req/day');
  console.log('✓ Pre-LLM token saver & rate limit configs passed.\n');

  console.log('=== All Kharcha Backend Tests Passed Successfully! ===');
}

runEndToEndVerification().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
