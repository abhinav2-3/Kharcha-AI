import { z } from 'zod';

export const CreateFeedbackSchema = z.object({
  message: z
    .string()
    .trim()
    .min(3, { message: 'Feedback must be at least 3 characters long.' })
    .max(1000, { message: 'Feedback cannot exceed 1000 characters.' }),
  category: z.enum(['bug', 'idea', 'other']).default('other'),
  metadata: z
    .object({
      userAgent: z.string().max(300).optional(),
      screen: z.string().max(50).optional(),
      theme: z.string().max(20).optional(),
    })
    .optional(),
});

export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>;

