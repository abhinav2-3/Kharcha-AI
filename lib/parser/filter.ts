/**
 * Fast zero-token heuristic check before invoking LLM.
 * Rejects obvious gibberish, spam, or empty text without burning Groq/Gemini API quotas.
 */
export function validatePreLLMInput(rawText: string): { valid: boolean; reason?: string } {
  const trimmed = rawText.trim();

  // 1. Minimum length
  if (trimmed.length < 2) {
    return {
      valid: false,
      reason: 'Input is too short to be an expense. Please specify what was spent.',
    };
  }

  // 2. Must contain at least one word or number character
  if (!/[a-zA-Z0-9\u0900-\u097F]/.test(trimmed)) {
    return {
      valid: false,
      reason: 'Please enter a valid expense description with text or amount.',
    };
  }

  // 3. Reject extreme repetitive character spam (e.g. "aaaaaaaaaaaa", "111111111111")
  if (/(.)\1{14,}/.test(trimmed)) {
    return {
      valid: false,
      reason: 'Input appears to be repetitive spam. Please describe a real expense.',
    };
  }

  return { valid: true };
}

