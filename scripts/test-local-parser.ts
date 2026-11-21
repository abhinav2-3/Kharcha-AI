import assert from 'assert';
import { parseLocalExpense } from '../lib/parser/local';

function runTests() {
  console.log('Testing lib/parser/local.ts (Local Fast Heuristic Parser)...');

  // Test 1: Standard digit + category + mode
  const t1 = parseLocalExpense('500 chai pe cash se');
  assert.strictEqual(t1.amount, 50000, '500 rupees should be 50000 paise');
  assert.strictEqual(t1.category, 'food');
  assert.strictEqual(t1.mode, 'cash');
  assert.strictEqual(t1.type, 'expense');
  console.log('✓ Test 1: "500 chai pe cash se" passed');

  // Test 2: Petrol + UPI with relative date or simple number
  const t2 = parseLocalExpense('kal petrol 300 upi');
  assert.strictEqual(t2.amount, 30000, '300 rupees should be 30000 paise');
  assert.strictEqual(t2.category, 'transport');
  assert.strictEqual(t2.mode, 'upi');
  console.log('✓ Test 2: "kal petrol 300 upi" passed');

  // Test 3: Hindi number word: dedh sau auto
  const t3 = parseLocalExpense('dedh sau auto');
  assert.strictEqual(t3.amount, 15000, 'dedh sau should be 15000 paise (150 rupees)');
  assert.strictEqual(t3.category, 'transport');
  console.log('✓ Test 3: "dedh sau auto" passed');

  // Test 4: Hindi number word: dhai sau kachori
  const t4 = parseLocalExpense('dhai sau kachori');
  assert.strictEqual(t4.amount, 25000, 'dhai sau should be 25000 paise (250 rupees)');
  assert.strictEqual(t4.category, 'food');
  console.log('✓ Test 4: "dhai sau kachori" passed');

  // Test 5: Paanch sau recharge
  const t5 = parseLocalExpense('paanch sau ka jio recharge');
  assert.strictEqual(t5.amount, 50000, 'paanch sau should be 50000 paise (500 rupees)');
  assert.strictEqual(t5.category, 'bills');
  console.log('✓ Test 5: "paanch sau ka jio recharge" passed');

  // Test 6: Salary credited 45000
  const t6 = parseLocalExpense('salary aayi 45000');
  assert.strictEqual(t6.amount, 4500000, '45000 rupees should be 4500000 paise');
  assert.strictEqual(t6.type, 'income');
  assert.strictEqual(t6.category, 'salary');
  console.log('✓ Test 6: "salary aayi 45000" passed');

  // Test 7: "5k" notation
  const t7 = parseLocalExpense('5k rent via netbanking');
  assert.strictEqual(t7.amount, 500000, '5k should be 5000 rupees (500000 paise)');
  assert.strictEqual(t7.category, 'rent');
  assert.strictEqual(t7.mode, 'bank_transfer');
  console.log('✓ Test 7: "5k rent via netbanking" passed');

  // Test 8: Devanagari numerals: ५००
  const t8 = parseLocalExpense('५०० coffee card se');
  assert.strictEqual(t8.amount, 50000, 'Devanagari ५०० should be 50000 paise');
  assert.strictEqual(t8.category, 'food');
  assert.strictEqual(t8.mode, 'card');
  console.log('✓ Test 8: "५०० coffee card se" passed');

  console.log('\nAll local heuristic parser tests passed!\n');
}

runTests();
