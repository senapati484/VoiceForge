import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createCampaignSchema } from '../validators/campaign.validator';
import { Campaign, Agent, CsvContact } from '../db';
import { createCampaign, runCampaign } from '../services/campaign.service';
import { AppError } from '../middleware/errorHandler';
import type { JwtPayload } from '../utils/jwt';

const router = Router();

// Multer config for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/csv'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// All routes require authentication
router.use(requireAuth);

// POST /campaigns - Upload CSV and create campaign
router.post('/', upload.single('csv'), validate(createCampaignSchema), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { agentId, name } = req.body as { agentId: string; name: string };

    if (!req.file) {
      throw new AppError('CSV file required', 400);
    }

    // Find agent and verify it's marketing or sales
    const agent = await Agent.findOne({ _id: agentId, userId });
    if (!agent) {
      throw new AppError('Agent not found', 404);
    }

    if (!['marketing', 'sales'].includes(agent.agentType)) {
      throw new AppError('Campaigns only supported for marketing and sales agents', 400);
    }

    const campaign = await createCampaign(userId, agentId, name, req.file.buffer);

    res.status(201).json({
      campaign,
      contactCount: campaign.totalContacts
    });
  } catch (err) {
    next(err);
  }
});

// POST /campaigns/:id/start - Start campaign
router.post('/:id/start', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { id } = req.params;

    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new AppError('Campaign cannot be started', 400);
    }

    // Verify agent is active
    const agent = await Agent.findOne({ _id: campaign.agentId, userId, isActive: true });
    if (!agent) {
      throw new AppError('Agent not found or inactive', 400);
    }

    // Update status
    await Campaign.findByIdAndUpdate(id, { status: 'running' });

    // Fire and forget - runs in background
    runCampaign(id).catch(console.error);

    res.json({ success: true, message: 'Campaign started' });
  } catch (err) {
    next(err);
  }
});

// POST /campaigns/:id/pause - Pause campaign
router.post('/:id/pause', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { id } = req.params;

    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    await Campaign.findByIdAndUpdate(id, { status: 'paused' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /campaigns - List campaigns
router.get('/', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    const campaigns = await Campaign.find({ userId })
      .sort({ createdAt: -1 })
      .populate('agentId', 'name agentType');

    res.json({ campaigns });
  } catch (err) {
    next(err);
  }
});

// GET /campaigns/:id - Get single campaign
router.get('/:id', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    const campaign = await Campaign.findOne({ _id: req.params.id, userId })
      .populate('agentId', 'name agentType');

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    res.json({ campaign });
  } catch (err) {
    next(err);
  }
});

// GET /campaigns/:id/contacts - Get contacts with pagination
router.get('/:id/contacts', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { id } = req.params;

    // Verify campaign ownership
    const campaign = await Campaign.findOne({ _id: id, userId });
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      CsvContact.find({ campaignId: id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      CsvContact.countDocuments({ campaignId: id })
    ]);

    res.json({ contacts, total, page });
  } catch (err) {
    next(err);
  }
});

export default router;
