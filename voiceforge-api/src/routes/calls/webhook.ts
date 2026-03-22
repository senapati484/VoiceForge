import type { Request, Response } from 'express';
import { config } from '../../config';
import { Agent, CallLog, User, CreditLedger, Campaign, CsvContact } from '../../db';
import { buildSystemPrompt } from '../../services/contextBuilder.service';
import { retrieveText } from '../../services/pinecone.service';

export async function webhookHandler(req: Request, res: Response): Promise<void> {
  try {
    // Step 1: Verify webhook secret ALWAYS first
    const secret = req.headers['x-vapi-secret'] as string;
    if (secret !== config.vapi.webhookSecret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Parse body (raw Buffer from express.raw())
    const body = JSON.parse((req.body as Buffer).toString('utf8'));

    // Handle different webhook types
    switch (body.type) {
      case 'function-call': {
        // Agent needs context during call (RAG)
        const { query, userId, agentId } = body.functionCall?.parameters || {};

        if (!userId || !agentId || !query) {
          res.status(400).json({ error: 'Missing parameters' });
          return;
        }

        const agent = await Agent.findById(agentId);
        if (!agent) {
          res.json({ result: 'Agent not found' });
          return;
        }

        // Retrieve relevant chunks from Pinecone
        const chunks = await retrieveText(userId, query, 3);
        const systemPrompt = buildSystemPrompt(agent, chunks);

        res.json({ result: systemPrompt });
        return;
      }

      case 'status-update': {
        // Update call status
        const vapiCallId = body.call?.id;
        const status = mapVapiStatus(body.status);

        if (vapiCallId) {
          await CallLog.findOneAndUpdate(
            { vapiCallId },
            { status },
            { new: true }
          );
        }

        res.json({ received: true });
        return;
      }

      case 'end-of-call-report': {
        // Final call report - deduct credits and update stats
        const vapiCallId = body.call?.id;
        const startedAt = new Date(body.call?.startedAt);
        const endedAt = new Date(body.call?.endedAt);
        const transcript = body.transcript || [];

        if (!vapiCallId) {
          res.json({ received: true });
          return;
        }

        // Get call direction and calculate credits
        const existingLog = await CallLog.findOne({ vapiCallId });
        const direction = existingLog?.direction || 'outbound';
        const durationSec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
        const costPerMin = direction === 'inbound' ? 2 : 3;
        const credits = Math.ceil(durationSec / 60) * costPerMin;

        // Update call log
        const log = await CallLog.findOneAndUpdate(
          { vapiCallId },
          {
            status: 'completed',
            transcript,
            durationSec,
            creditsUsed: credits,
            endedAt,
            startedAt
          },
          { new: true }
        );

        if (log) {
          // Deduct credits from user
          await User.findByIdAndUpdate(log.userId, { $inc: { credits: -credits } });

          // Record in credit ledger
          await CreditLedger.create({
            userId: log.userId,
            type: 'deduct',
            amount: -credits,
            description: `${direction} call ${durationSec}s (${costPerMin}/min)`,
            callLogId: log._id
          });

          // If this was a campaign call, update CsvContact and Campaign stats
          if (log.csvContactId && log.campaignId) {
            const endedReason = body.call?.endedReason;
            const isAnswered = endedReason === 'customer-ended' || transcript.length > 1;

            await CsvContact.findByIdAndUpdate(log.csvContactId, {
              status: isAnswered ? 'answered' : 'no-answer',
              callLogId: log._id,
              calledAt: new Date()
            });

            await Campaign.findByIdAndUpdate(log.campaignId, {
              $inc: {
                called: 1,
                ...(isAnswered ? { answered: 1 } : { noAnswer: 1 })
              }
            });
          }
        }

        res.json({ received: true });
        return;
      }

      default:
        res.json({ received: true });
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function mapVapiStatus(vapiStatus: string): string {
  const statusMap: Record<string, string> = {
    initiated: 'initiated',
    'in-progress': 'in-progress',
    completed: 'completed',
    failed: 'failed'
  };
  return statusMap[vapiStatus] || vapiStatus;
}
