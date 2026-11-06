import { z } from 'zod';
import { ALL_CATEGORIES, ENTRY_TYPES, PAYMENT_MODES, SOURCES } from '@/lib/constants';

export const CreateEntryInputSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  rawText: z.string().min(1, 'rawText cannot be empty').max(500, 'rawText exceeds 500 characters'),
  source: z.enum(SOURCES).default('text'),
});

export const UpdateEntryInputSchema = z.object({
  amount: z.number().positive().max(10_000_000, 'Amount cannot exceed ₹1,00,00,000').optional(), // Amount in Rupees
  amountPaise: z.number().int().positive().max(1_000_000_000, 'Amount in paise cannot exceed ₹1,00,00,000').optional(), // Direct paise
  type: z.enum(ENTRY_TYPES).optional(),
  category: z.enum(ALL_CATEGORIES).optional(),
  categoryHint: z.string().max(100).nullable().optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  note: z.string().max(100).nullable().optional(),
  spentAt: z.string().datetime().optional(),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rawText: z.string().max(500).optional(),
  source: z.enum(SOURCES).optional(),
  restore: z.boolean().optional(),
});

