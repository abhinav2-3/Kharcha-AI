import { z } from 'zod';
import { ENTRY_TYPES, PAYMENT_MODES } from '@/lib/constants';

export const RawLLMItemSchema = z.object({
  amount: z
    .number()
    .positive()
    .nullable()
    .catch(null),
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

