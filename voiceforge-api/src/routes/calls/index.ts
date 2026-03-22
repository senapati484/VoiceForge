import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { outboundCallSchema } from '../../validators/call.validator';
import { Agent, CallLog, User, CreditLedger, Campaign, CsvContact } from '../../db';
import { triggerOutboundCall } from '../../services/vapi.service';
import { AppError } from '../../middleware/errorHandler';
import type { JwtPayload } from '../../utils/jwt';

const router = Router();

// POST /calls/outbound - Initiate outbound call (requireAuth)
router.post('/outbound', requireAuth, validate(outboundCallSchema), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { agentId, toNumber } = req.body as { agentId: string; toNumber: string };

    // Check credits
    const user = await User.findById(userId);
    if (!user || user.credits < 5) {
      throw new AppError('Insufficient credits', 402);
    }

    // Find and verify agent
    const agent = await Agent.findOne({ _id: agentId, userId, isActive: true });
    if (!agent) {
      throw new AppError('Agent not found or inactive', 404);
    }

    if (!agent.vapiAgentId) {
      throw new AppError('Agent not configured with Vapi', 500);
    }

    // Trigger call via Vapi
    const vapiRes = await triggerOutboundCall(agent.vapiAgentId, toNumber, {
      userId,
      agentId
    });

    // Create call log
    const log = await CallLog.create({
      userId,
      agentId,
      vapiCallId: vapiRes.id,
      direction: 'outbound',
      toNumber,
      status: 'initiated'
    });

    res.json({ callId: log._id, vapiCallId: vapiRes.id });
  } catch (err) {
    next(err);
  }
});

// GET /calls - List calls (paginated, requireAuth)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const calls = await CallLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('agentId', 'name agentType');

    // Transform calls to match frontend expectations
    const transformedCalls = calls.map(call => {
      const callObj = call.toObject();
      return {
        ...callObj,
        id: callObj._id.toString(),
        agentId: callObj.agentId?._id?.toString() || callObj.agentId?.toString(),
        agentName: callObj.agentId?.name || 'Unknown Agent',
        // Ensure all fields are present
        direction: callObj.direction,
        toNumber: callObj.toNumber || callObj.fromNumber,
        status: callObj.status,
        durationSec: callObj.durationSec,
        transcript: callObj.transcript,
        creditsUsed: callObj.creditsUsed,
        createdAt: callObj.createdAt?.toISOString(),
        campaignId: callObj.campaignId?.toString()
      };
    });

    res.json({ calls: transformedCalls, page });
  } catch (err) {
    next(err);
  }
});

// GET /calls/:id - Get single call (requireAuth)
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    const call = await CallLog.findOne({ _id: req.params.id, userId })
      .populate('agentId', 'name agentType');

    if (!call) {
      throw new AppError('Call not found', 404);
    }

    res.json({ call });
  } catch (err) {
    next(err);
  }
});

export default router;
