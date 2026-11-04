import { z } from 'zod';
import { ALL_CATEGORIES, ENTRY_TYPES, PAYMENT_MODES, SOURCES } from '@/lib/constants';

export const CreateEntryInputSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  rawText: z.string().min(1, 'rawText cannot be empty').max(500, 'rawText exceeds 500 characters'),
  source: z.enum(SOURCES).default('text'),
});

export const UpdateEntryInputSchema = z.object({
  amount: z.number().positive().optional(), // Amount in Rupees if provided in UI/Postman
  amountPaise: z.number().int().positive().optional(), // Direct paise if provided
  type: z.enum(ENTRY_TYPES).optional(),
  category: z.enum(ALL_CATEGORIES).optional(),
  categoryHint: z.string().max(100).nullable().optional(),
  mode: z.enum(PAYMENT_MODES).optional(),
  note: z.string().max(100).nullable().optional(),
  spentAt: z.string().datetime().optional(),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

