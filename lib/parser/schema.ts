import { z } from 'zod';
import { ENTRY_TYPES, PAYMENT_MODES } from '@/lib/constants';

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

function parseAmountValue(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const converted = val.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d).replace(/,/g, '').trim();
    const num = Number(converted);
    return !isNaN(num) && Number.isFinite(num) ? num : null;
  }
  return null;
}

export const RawLLMItemSchema = z.object({
  amount: z.preprocess(
    parseAmountValue,
    z
      .number()
      .positive()
      .max(10_000_000)
      .nullable()
      .catch(null)
  ),
  type: z
    .enum(ENTRY_TYPES)
    .catch('expense'),
  category: z
    .string()
    .default('other')
    .catch('other'),
  categoryHint: z
    .string()
    .nullable()
    .optional()
    .catch(null),
  mode: z
    .enum(PAYMENT_MODES)
    .catch('cash'),
  note: z
    .string()
    .nullable()
    .optional()
    .catch(null),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .catch(null),
});

export const ParserOutputSchema = z.object({
  entries: z.array(RawLLMItemSchema).max(5).default([]),
});

export type RawLLMItemValidated = z.infer<typeof RawLLMItemSchema>;
export type ParserOutputValidated = z.infer<typeof ParserOutputSchema>;

