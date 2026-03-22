import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { scrapeUrlSchema, generateContextSchema } from '../validators/knowledge.validator';
import { KnowledgeDoc, User, CreditLedger, UserKnowledgeContext } from '../db';
import { COSTS } from '../services/credits.service';
import { uploadToR2, r2DocKey, r2ScrapeKey, deleteFromR2 } from '../services/r2.service';
import { scrapeUrl } from '../services/scraper.service';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import type { JwtPayload } from '../utils/jwt';
import mongoose from 'mongoose';

const router = Router();

function isStorageError(err: any): boolean {
  return Boolean(err?.r2 || err?.code === 'InvalidArgument' || err?.message?.includes('R2'));
}

// Multer config for document upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/msword'
    ];
    const allowedExts = ['.pdf', '.docx', '.txt', '.doc'];
    const hasAllowedType = allowedTypes.includes(file.mimetype);
    const hasAllowedExt = allowedExts.some(ext =>
      file.originalname.toLowerCase().endsWith(ext)
    );
    if (hasAllowedType || hasAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
    }
  }
});

// All routes require authentication
router.use(requireAuth);

// POST /knowledge/upload - Upload document
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    if (!req.file) {
      throw new AppError('File required', 400);
    }

    // Check credits
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.credits < COSTS.DOC) {
      throw new AppError(`Insufficient credits (${COSTS.DOC} required)`, 402);
    }

    // Determine type from filename
    const filename = req.file.originalname;
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      pdf: 'pdf',
      docx: 'docx',
      doc: 'docx',
      txt: 'txt'
    };
    const type = typeMap[ext || ''] || 'txt';

    // Generate doc ID and upload to R2
    const mongoose = await import('mongoose');
    const docId = new mongoose.Types.ObjectId().toString();
    const r2Key = r2DocKey(userId, docId, filename);
    await uploadToR2(r2Key, req.file.buffer, req.file.mimetype);

    // Create document record; when RAG disabled, mark ready so context can be built without worker
    const doc = await KnowledgeDoc.create({
      userId,
      agentId: req.body.agentId || undefined,
      type,
      filename,
      r2Key,
      status: config.ragEnabled ? 'pending' : 'ready'
    });

    // Deduct credits
    await User.findByIdAndUpdate(userId, { $inc: { credits: -COSTS.DOC } });
    await CreditLedger.create({
      userId,
      type: 'deduct',
      amount: -COSTS.DOC,
      description: `Document upload: ${filename}`
    });

    res.status(201).json({ docId: doc._id, status: doc.status });
  } catch (err) {
    console.error('[Knowledge Upload] Error:', err);
    if (isStorageError(err)) {
      return next(new AppError('Upload failed. Please verify storage credentials and try again.', 500));
    }
    next(err);
  }
});

// POST /knowledge/scrape - Scrape URL
router.post('/scrape', validate(scrapeUrlSchema), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { url, agentId } = req.body as { url: string; agentId?: string };

    // Check credits
    const user = await User.findById(userId);
    if (!user || user.credits < COSTS.SCRAPE) {
      throw new AppError(`Insufficient credits (${COSTS.SCRAPE} required)`, 402);
    }

    // Scrape URL
    const text = await scrapeUrl(url);

    // Upload to R2
    const docId = new (await import('mongoose')).Types.ObjectId().toString();
    const r2Key = r2ScrapeKey(userId, docId);
    await uploadToR2(r2Key, Buffer.from(text, 'utf-8'), 'text/plain');

    // Create document record; when RAG disabled, mark ready so context can be built without worker
    const doc = await KnowledgeDoc.create({
      userId,
      agentId: agentId || undefined,
      type: 'scrape',
      sourceUrl: url,
      r2Key,
      status: config.ragEnabled ? 'pending' : 'ready'
    });

    // Deduct credits
    await User.findByIdAndUpdate(userId, { $inc: { credits: -COSTS.SCRAPE } });
    await CreditLedger.create({
      userId,
      type: 'deduct',
      amount: -COSTS.SCRAPE,
      description: `Web scrape: ${url.slice(0, 50)}...`
    });

    res.status(201).json({ docId: doc._id, status: doc.status });
  } catch (err) {
    if (isStorageError(err)) {
      return next(new AppError('Website content upload failed. Please verify storage credentials and try again.', 500));
    }
    next(err);
  }
});

// GET /knowledge/status/:docId - Check document status
router.get('/status/:docId', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { docId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      throw new AppError('Invalid document id', 400);
    }

    const doc = await KnowledgeDoc.findOne({ _id: docId, userId });
    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    res.json({
      id: doc._id.toString(),
      status: doc.status,
      chunkCount: doc.chunkCount,
      filename: doc.filename,
      errorMsg: doc.errorMsg,
      type: doc.type
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /knowledge/:docId - Delete document and R2 object
router.delete('/:docId', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { docId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(docId)) {
      throw new AppError('Invalid document id', 400);
    }

    const doc = await KnowledgeDoc.findOne({ _id: docId, userId });
    if (!doc) {
      throw new AppError('Document not found', 404);
    }

    if (doc.r2Key) {
      await deleteFromR2(doc.r2Key);
    }
    await KnowledgeDoc.deleteOne({ _id: docId, userId });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /knowledge/generate-context - Build knowledge file and upsert UserKnowledgeContext
router.post('/generate-context', validate(generateContextSchema), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    // Check credits (3 required for context generation)
    const user = await User.findById(userId);
    if (!user || user.credits < COSTS.CONTEXT) {
      throw new AppError(`Insufficient credits (${COSTS.CONTEXT} required)`, 402);
    }

    const { buildKnowledgeFile } = await import('../services/contextBuilder.service');
    const knowledgeFile = await buildKnowledgeFile(userId);

    const saved = await UserKnowledgeContext.findOneAndUpdate(
      { userId },
      { knowledgeFile, generatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Deduct credits for context generation
    await User.findByIdAndUpdate(userId, { $inc: { credits: -COSTS.CONTEXT } });
    await CreditLedger.create({
      userId,
      type: 'deduct',
      amount: -COSTS.CONTEXT,
      description: 'Generate knowledge context'
    });

    res.json({
      success: true,
      knowledgeFile,
      context: {
        generatedAt: saved?.generatedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /knowledge/context - Read latest generated context for this user
router.get('/context', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const context = await UserKnowledgeContext.findOne({ userId }).select('-__v');
    if (!context) {
      res.json({ context: null });
      return;
    }

    res.json({
      context: {
        id: context._id.toString(),
        knowledgeFile: context.knowledgeFile,
        generatedAt: context.generatedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /knowledge - List all documents
router.get('/', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    const docs = await KnowledgeDoc.find({ userId })
      .sort({ uploadedAt: -1 })
      .select('-__v');

    res.json({
      docs: docs.map((doc) => ({
        id: doc._id.toString(),
        type: doc.type,
        filename: doc.filename,
        sourceUrl: doc.sourceUrl,
        status: doc.status,
        chunkCount: doc.chunkCount,
        errorMsg: doc.errorMsg
      }))
    });
  } catch (err) {
    next(err);
  }
});

export default router;
