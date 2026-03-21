import { z } from 'zod';

export const outboundCallSchema = z.object({
  agentId: z.string(),
  toNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number format (E.164 required)')
});

export type OutboundCallInput = z.infer<typeof outboundCallSchema>;
