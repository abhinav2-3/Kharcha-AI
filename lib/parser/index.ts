import { buildParserSystemPrompt } from './prompt';
import { getLLMProvider } from './providers';
import { ParserOutputSchema } from './schema';
import { normalizeParsedItem } from './normalize';
import { ParsedItem } from './types';

export interface ParseOptions {
  providerName?: string;
  referenceDate?: Date;
  timeoutMs?: number;
}

/**
 * Parses user text using the configured dynamic LLM provider.
 * Follows core principle: "Never lose user data. If parsing fails, raw text is saved."
 */
export async function parse(
  rawText: string,
  options?: ParseOptions
): Promise<ParsedItem[]> {
  const trimmed = rawText.trim();
  const refDate = options?.referenceDate || new Date();

  if (!trimmed) {
    return [];
  }

  // Fallback item when LLM completely fails or throws
  const createFailedFallback = (): ParsedItem[] => [
    normalizeParsedItem(
      {
        amount: null,
        type: 'expense',
        category: 'other',
        categoryHint: null,
        mode: 'cash',
        note: null,
        date: null,
      },
      refDate
    ),
  ];

  try {
    const provider = getLLMProvider(options?.providerName);
    const systemPrompt = buildParserSystemPrompt(refDate);

    const jsonText = await provider.generateJSON(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: trimmed },
      ],
      { timeoutMs: options?.timeoutMs || 8000 }
    );

    // Parse returned JSON text
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (jsonErr) {
      console.warn('LLM did not return valid JSON:', jsonText, jsonErr);
      return createFailedFallback();
    }

    // Validate with Zod
    const validationResult = ParserOutputSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      console.warn('Parser Zod validation failed:', validationResult.error);
      return createFailedFallback();
    }

    const { entries } = validationResult.data;

    // Non-transaction messages (e.g. "aaj kuch kharch nahi hua" -> entries: [])
    if (entries.length === 0) {
      return [];
    }

    // Normalize each item (max 5 enforced by schema)
    return entries.map((item) => normalizeParsedItem(item, refDate));
  } catch (error) {
    console.error('Error during LLM extraction:', error);
    // On timeout, network failure, or API quota error, gracefully return failed entry
    return createFailedFallback();
  }
}

export * from './types';
export * from './prompt';
export * from './schema';
export * from './normalize';

