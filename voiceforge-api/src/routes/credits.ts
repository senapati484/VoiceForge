import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { User, CreditLedger } from '../db';
import { addCredits } from '../services/credits.service';
import { AppError } from '../middleware/errorHandler';
import type { JwtPayload } from '../utils/jwt';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// GET /credits - Get balance and recent transactions
router.get('/', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    // Get user credits
    const user = await User.findById(userId).select('credits');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Get last 20 transactions
    const transactions = await CreditLedger.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-__v');

    res.json({
      credits: user.credits,
      transactions
    });
  } catch (err) {
    next(err);
  }
});

// POST /credits/purchase - Purchase credits (stub for Phase 2: Razorpay)
const purchaseSchema = z.object({
  packId: z.enum(['starter', 'growth', 'business'])
});

router.post('/purchase', validate(purchaseSchema), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { packId } = req.body as { packId: 'starter' | 'growth' | 'business' };

    // Credit pack amounts
    const amounts: Record<string, number> = {
      starter: 100,
      growth: 500,
      business: 2000
    };

    const creditsAdded = amounts[packId];

    // Add credits (Phase 2: Add Razorpay HMAC webhook verification here)
    await addCredits(
      userId,
      creditsAdded,
      `Purchased ${packId} pack`,
      'stub-payment-ref'
    );

    // Get updated balance
    const user = await User.findById(userId).select('credits');

    res.json({
      success: true,
      creditsAdded,
      newTotal: user?.credits || 0
    });
  } catch (err) {
    next(err);
  }
});

export default router;
