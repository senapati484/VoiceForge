import { z } from 'zod';

export const createCampaignSchema = z.object({
  agentId: z.string(),
  name: z.string().min(2).max(100)
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
