import { CreateFeedbackSchema } from '../lib/validations/feedback';
import { Feedback } from '../models/Feedback';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[FAIL] ${message}`);
  }
}

async function runFeedbackTests() {
  console.log('=== Developer Feedback Feature Test Suite ===\n');

  // 1. Zod Validation Tests
  console.log('1. Testing Feedback Schema Validation...');
  const validFeedback = CreateFeedbackSchema.safeParse({
    message: 'Great app! Would love a monthly budget target feature.',
    category: 'idea',
    metadata: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      screen: '390x844',
      theme: 'dark',
    },
  });
  assert(validFeedback.success, 'Valid feedback payload accepted');

  const tooShortFeedback = CreateFeedbackSchema.safeParse({
    message: 'hi',
  });
  assert(!tooShortFeedback.success, 'Feedback < 3 chars rejected');

  const tooLongFeedback = CreateFeedbackSchema.safeParse({
    message: 'a'.repeat(1001),
  });
  assert(!tooLongFeedback.success, 'Feedback > 1000 chars rejected');

  const defaultCategoryFeedback = CreateFeedbackSchema.safeParse({
    message: 'General thoughts on the layout.',
  });
  assert(
    defaultCategoryFeedback.success && defaultCategoryFeedback.data.category === 'other',
    'Default category defaults to "other"'
  );
  console.log('✓ Validation schema tests passed.\n');

  // 2. Mongoose Model Validation
  console.log('2. Testing Feedback Model Structure...');
  const testDoc = new Feedback({
    userId: 'test-user-feedback-123',
    message: 'Found an issue with voice typing in Hindi',
    category: 'bug',
    email: 'tester@example.com',
    metadata: { screen: '412x915', theme: 'system' },
  });

  assert(testDoc.status === 'new', 'Initial status defaults to "new"');
  assert(testDoc.category === 'bug', 'Category set to "bug"');
  assert(testDoc.userId === 'test-user-feedback-123', 'UserId attached correctly');
  console.log('✓ Mongoose model validation passed.\n');

  console.log('=== All Developer Feedback Tests Passed Successfully! ===');
}

runFeedbackTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

