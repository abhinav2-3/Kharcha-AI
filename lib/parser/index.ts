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

    // Sanitize user text to prevent tag breakouts & prompt injection escapes
    const sanitizedInput = trimmed
      .replace(/<\/?user_expense_input>/gi, '')
      .slice(0, 500);

    const userMessageContent = `<user_expense_input>\n${sanitizedInput}\n</user_expense_input>`;

    let jsonText: string;
    try {
      jsonText = await provider.generateJSON(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessageContent },
        ],
        { timeoutMs: options?.timeoutMs || 8000 }
      );
    } catch (primaryErr) {
      console.warn(`Primary LLM provider (${provider.name}) failed:`, primaryErr);

      // Auto-failover: If primary is groq and GEMINI_API_KEY is available, try Gemini
      if (provider.name === 'groq' && process.env.GEMINI_API_KEY) {
        console.info('Attempting auto-failover to Gemini provider...');
        const backupProvider = getLLMProvider('gemini');
        jsonText = await backupProvider.generateJSON(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageContent },
          ],
          { timeoutMs: options?.timeoutMs || 8000 }
        );
      } else if (provider.name === 'gemini' && process.env.GROQ_API_KEY) {
        console.info('Attempting auto-failover to Groq provider...');
        const backupProvider = getLLMProvider('groq');
        jsonText = await backupProvider.generateJSON(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessageContent },
          ],
          { timeoutMs: options?.timeoutMs || 8000 }
        );
      } else {
        throw primaryErr;
      }
    }

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

