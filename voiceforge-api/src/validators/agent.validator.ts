import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(2).max(50),
  agentType: z.enum(['marketing', 'support', 'sales', 'tech']),
  businessName: z.string().min(2).max(100),
  description: z.string().min(30).max(1500),
  voiceId: z.string().min(1),
  voiceName: z.string().min(1),
  language: z.string().default('en-US'),
  tone: z.enum(['professional', 'friendly', 'casual', 'confident', 'empathetic', 'consultative']).default('professional'),
  callObjective: z.string().min(10).max(200)
});

export const updateAgentSchema = createAgentSchema.partial();

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
