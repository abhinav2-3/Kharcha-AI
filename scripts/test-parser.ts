import { normalizeParsedItem, getISTDateString } from '../lib/parser/normalize';
import { getLLMProvider } from '../lib/parser/providers';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runTests() {
  console.log('--- Testing Kharcha Parser Normalizer ---');

  // Test 1: Standard expense normalization
  const item1 = normalizeParsedItem({
    amount: 500,
    type: 'expense',
    category: 'food',
    mode: 'cash',
    note: 'chai and biscuit',
    date: null,
  });
  assert(item1.amount === 50000, '500 INR should be 50000 paise');
  assert(item1.type === 'expense', 'type should be expense');
  assert(item1.category === 'food', 'category should be food');
  assert(item1.mode === 'cash', 'mode should be cash');
  assert(item1.parseStatus === 'ok', 'parseStatus should be ok');
  console.log('✓ Test 1: Standard expense conversion passed');

  // Test 2: Missing amount (fail-safe extraction)
  const item2 = normalizeParsedItem({
    amount: null,
    type: 'expense',
    category: 'food',
    note: 'kal chai pi',
  });
  assert(item2.amount === null, 'amount should be null');
  assert(item2.mode === 'cash', 'default mode should be cash');
  assert(item2.parseStatus === 'failed', 'parseStatus should be failed when amount is null');
  console.log('✓ Test 2: Missing amount and default cash mode passed');

  // Test 3: Category reconciliation (income with food category -> other_income)
  const item3 = normalizeParsedItem({
    amount: 1000,
    type: 'income',
    category: 'food',
    note: 'refund for food',
  });
  assert(item3.type === 'income', 'type should be income');
  assert(item3.category === 'other_income', 'mismatched category should revert to other_income');
  assert(item3.categoryHint === 'food', 'original category preserved in categoryHint');
  console.log('✓ Test 3: Category reconciliation passed');

  // Test 4: Past date resolution
  const item4 = normalizeParsedItem({
    amount: 250,
    type: 'expense',
    category: 'fuel',
    date: '2026-10-20',
  });
  assert(item4.spentOn === '2026-10-20', 'spentOn should match past date YYYY-MM-DD');
  assert(item4.spentAt.toISOString().includes('2026-10-20'), 'spentAt should be in the past date');
  console.log('✓ Test 4: Past date resolution passed');

  // Test 5: Dynamic LLM provider factory
  const defaultProvider = getLLMProvider();
  assert(defaultProvider.name === 'groq', 'Default provider should be Groq');

  const geminiProvider = getLLMProvider('gemini');
  assert(geminiProvider.name === 'gemini', 'Explicit gemini provider should instantiate Gemini');
  console.log('✓ Test 5: Dynamic LLM provider factory passed');

  console.log('All Parser & Normalizer tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

