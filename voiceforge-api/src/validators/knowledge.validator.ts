import { z } from 'zod';

export const scrapeUrlSchema = z.object({
  url: z.string().url(),
  agentId: z.string().optional()
});

export const generateContextSchema = z.object({
  agentType: z.enum(['marketing', 'support', 'sales', 'tech']).optional().default('support')
});

export type ScrapeUrlInput = z.infer<typeof scrapeUrlSchema>;
export type GenerateContextInput = z.infer<typeof generateContextSchema>;
