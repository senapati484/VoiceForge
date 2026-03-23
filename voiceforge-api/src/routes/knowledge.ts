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

// TEMPORARY: Debug endpoint without auth for testing
router.get('/debug-test', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'Add ?userId=YOUR_USER_ID' });
      return;
    }

    console.log(`[Debug] Testing for user: ${userId}`);

    // Check User
    const user = await User.findById(userId);
    console.log(`[Debug] User found: ${!!user}, credits: ${user?.credits}`);

    // Check documents
    const docs = await KnowledgeDoc.find({ userId, status: 'ready' });
    console.log(`[Debug] Ready docs: ${docs.length}`);

    const results = [];

    for (const doc of docs) {
      console.log(`[Debug] Testing doc: ${doc._id}, type: ${doc.type}, filename: ${doc.filename}`);

      try {
        const { getFileFromR2 } = await import('../services/r2.service');
        const file = await getFileFromR2(doc.r2Key);

        let buffer: Buffer;
        if (Buffer.isBuffer(file.Body)) {
          buffer = file.Body;
        } else if (file.Body && typeof (file.Body as any).pipe === 'function') {
          const chunks: Buffer[] = [];
          const stream = file.Body as NodeJS.ReadableStream;
          await new Promise((resolve, reject) => {
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', resolve);
            stream.on('error', reject);
          });
          buffer = Buffer.concat(chunks);
        } else if (file.Body) {
          buffer = Buffer.from(String(file.Body));
        } else {
          throw new Error('Empty body');
        }

        console.log(`[Debug] Doc ${doc._id}: buffer size = ${buffer.length}`);

        let text = '';
        let extractionMethod = '';

        if (doc.type === 'pdf') {
          const pdfModule = await import('pdf-parse');
          const parser = new pdfModule.PDFParse({ data: buffer });
          const result = await parser.getText();
          text = result.text || '';
          extractionMethod = 'pdf-parse';
        } else if (doc.type === 'docx') {
          const { default: mammoth } = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          text = result.value || '';
          extractionMethod = 'mammoth';
        } else {
          text = buffer.toString('utf8');
          extractionMethod = 'toString';
        }

        console.log(`[Debug] Doc ${doc._id}: extracted ${text.length} chars via ${extractionMethod}`);

        // Validation
        const isTooShort = text.length < 50;
        const isRawPdf = text.startsWith('%PDF') || (text.includes('xref') && text.includes('endobj'));
        const printableChars = (text.match(/[\x20-\x7E\n\r\t]/g) || []).length;
        const printableRatio = text.length > 0 ? printableChars / text.length : 0;
        const isValid = !isTooShort && !isRawPdf && printableRatio >= 0.5;

        results.push({
          docId: doc._id.toString(),
          type: doc.type,
          filename: doc.filename,
          bufferSize: buffer.length,
          textLength: text.length,
          extractionMethod,
          printableRatio: (printableRatio * 100).toFixed(1) + '%',
          isValid,
          isTooShort,
          isRawPdf,
          textPreview: text.slice(0, 200)
        });

      } catch (err: any) {
        console.error(`[Debug] Doc ${doc._id} failed:`, err.message);
        results.push({
          docId: doc._id.toString(),
          type: doc.type,
          filename: doc.filename,
          error: err.message
        });
      }
    }

    // Count valid docs
    const validDocs = results.filter((r: any) => r.isValid);

    res.json({
      userId,
      userFound: !!user,
      totalDocs: docs.length,
      validDocs: validDocs.length,
      results,
      suggestion: validDocs.length === 0 ? 'No valid documents found - check extraction errors above' : 'Ready to generate context'
    });

  } catch (err: any) {
    console.error('[Debug] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

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

// POST /knowledge/scrape - Scrape URL with optional context generation
router.post('/scrape', validate(scrapeUrlSchema), async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;
    const { url, agentId } = req.body as { url: string; agentId?: string };

    // Check credits
    const user = await User.findById(userId);
    if (!user || user.credits < COSTS.SCRAPE) {
      throw new AppError(`Insufficient credits (${COSTS.SCRAPE} required)`, 402);
    }

    // Scrape URL using enhanced scraper
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

    // Check if we should auto-generate context
    // Count existing ready documents
    const readyDocs = await KnowledgeDoc.countDocuments({
      userId,
      status: 'ready'
    });

    // Return enhanced response with context generation hint
    res.status(201).json({
      docId: doc._id,
      status: doc.status,
      sourceUrl: url,
      contentPreview: text.slice(0, 500) + (text.length > 500 ? '...' : ''),
      stats: {
        totalDocs: readyDocs + 1,
        readyForContext: true
      },
      // Suggest next steps
      nextStep: readyDocs >= 1
        ? 'You now have multiple documents. Consider generating context to build a knowledge base.'
        : 'Upload more documents or generate context to build a knowledge base.'
    });
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

    // Check if there are ready documents to process
    const readyDocs = await KnowledgeDoc.countDocuments({
      userId,
      status: 'ready'
    });

    if (readyDocs === 0) {
      throw new AppError('No documents ready for processing. Please upload documents and wait for them to be processed.', 400);
    }

    // Check credits (3 required for context generation)
    const user = await User.findById(userId);
    if (!user || user.credits < COSTS.CONTEXT) {
      throw new AppError(`Insufficient credits (${COSTS.CONTEXT} required)`, 402);
    }

    // Build knowledge file using AI-powered extraction
    const { buildKnowledgeFile } = await import('../services/contextBuilder.service');
    const knowledgeFile = await buildKnowledgeFile(userId);

    // Save to UserKnowledgeContext
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

    // Return comprehensive response
    res.json({
      success: true,
      knowledgeFile,
      stats: {
        documentsProcessed: readyDocs,
        businessSummaryLength: knowledgeFile.businessSummary?.length || 0,
        productsFound: knowledgeFile.keyProducts?.length || 0,
        qaPairs: knowledgeFile.commonQA?.length || 0,
        importantFacts: knowledgeFile.importantFacts?.length || 0,
        escalationTriggers: knowledgeFile.escalationTriggers?.length || 0
      },
      context: {
        id: saved?._id.toString(),
        generatedAt: saved?.generatedAt,
        isReady: Boolean(
          knowledgeFile.businessSummary ||
          knowledgeFile.keyProducts?.length > 0 ||
          knowledgeFile.commonQA?.length > 0
        )
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

    // Calculate stats from stored knowledgeFile
    const knowledgeFile = context.knowledgeFile as any;

    res.json({
      context: {
        id: context._id.toString(),
        knowledgeFile: context.knowledgeFile,
        generatedAt: context.generatedAt,
        stats: {
          businessSummaryLength: knowledgeFile?.businessSummary?.length || 0,
          productsFound: knowledgeFile?.keyProducts?.length || 0,
          qaPairs: knowledgeFile?.commonQA?.length || 0,
          importantFacts: knowledgeFile?.importantFacts?.length || 0,
          escalationTriggers: knowledgeFile?.escalationTriggers?.length || 0
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /knowledge/test-extraction/:docId - Test document extraction
router.get('/test-extraction/:docId', async (req, res, next) => {
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

    // Import extraction functions
    const { getFileFromR2 } = await import('../services/r2.service');
    const file = await getFileFromR2(doc.r2Key);

    // Check body type
    const isBuffer = Buffer.isBuffer(file.Body);
    const hasPipe = file.Body && typeof (file.Body as any).pipe === 'function';

    // Convert to buffer
    let buffer: Buffer;
    if (Buffer.isBuffer(file.Body)) {
      buffer = file.Body;
    } else if (file.Body && hasPipe) {
      // It's a stream
      const chunks: Buffer[] = [];
      const stream = file.Body as NodeJS.ReadableStream;
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      buffer = Buffer.concat(chunks);
    } else if (file.Body) {
      // Try to convert to string then buffer
      buffer = Buffer.from(String(file.Body));
    } else {
      throw new AppError('Empty file body', 500);
    }

    // Check file header
    const header = buffer.slice(0, 20).toString('ascii');
    const hexHeader = buffer.slice(0, 8).toString('hex');

    // Try extraction
    let extractedText = '';
    let extractionError = '';
    let rawPdfData: any = null;

    try {
      if (doc.type === 'pdf') {
        const pdfModule = await import('pdf-parse');
        const parser = new pdfModule.PDFParse({ data: buffer });
        const result = await parser.getText();
        extractedText = result.text || '';
        rawPdfData = {
          textLength: result.text?.length,
          hasText: !!result.text && result.text.length > 0
        };
      } else if (doc.type === 'docx') {
        const { default: mammoth } = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || '';
      } else {
        extractedText = buffer.toString('utf8');
      }
    } catch (err: any) {
      extractionError = err.message;
      console.error('[TestExtraction] Extraction error:', err);
    }

    // Validate text using same logic as contextBuilder
    const textLength = extractedText.length;
    const nonPrintableCount = (extractedText.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
    const nonPrintableRatio = textLength > 0 ? nonPrintableCount / textLength : 0;
    const printableChars = (extractedText.match(/[\x20-\x7E\n\r\t]/g) || []).length;
    const printableRatio = textLength > 0 ? printableChars / textLength : 0;
    const isTooShort = textLength < 50;
    const isRawPdf = extractedText.startsWith('%PDF') || (extractedText.includes('xref') && extractedText.includes('endobj'));
    const isValid = !isTooShort && nonPrintableRatio <= 0.05 && !isRawPdf && printableRatio >= 0.7;

    res.json({
      doc: {
        id: doc._id.toString(),
        type: doc.type,
        filename: doc.filename,
        r2Key: doc.r2Key,
        status: doc.status
      },
      fileInfo: {
        size: buffer.length,
        isBuffer,
        hasPipe,
        header: header.replace(/[^\x20-\x7E]/g, '?'),
        hexHeader
      },
      extraction: {
        success: extractedText.length > 0,
        textLength: extractedText.length,
        textPreview: extractedText.slice(0, 1000),
        rawPdfData,
        error: extractionError || undefined
      },
      validation: {
        isValid,
        isTooShort,
        isRawPdf,
        nonPrintableCount,
        nonPrintableRatio: (nonPrintableRatio * 100).toFixed(2) + '%',
        printableChars,
        printableRatio: (printableRatio * 100).toFixed(2) + '%',
        reasons: [
          isTooShort ? 'Text too short (< 50 chars)' : null,
          nonPrintableRatio > 0.05 ? `Too many non-printable chars (${(nonPrintableRatio * 100).toFixed(1)}%)` : null,
          isRawPdf ? 'Text appears to be raw PDF binary' : null,
          printableRatio < 0.7 ? `Low printable ratio (${(printableRatio * 100).toFixed(1)}%)` : null
        ].filter(Boolean)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /knowledge/debug-context - Debug context generation
router.get('/debug-context', async (req, res, next) => {
  try {
    const userId = (req.user as JwtPayload).userId;

    // Fetch all ready documents
    const docs = await KnowledgeDoc.find({ userId, status: 'ready' });

    const docDetails = [];
    for (const doc of docs) {
      const details: any = {
        id: doc._id.toString(),
        type: doc.type,
        filename: doc.filename,
        status: doc.status,
        extractionAttempt: null,
        error: null
      };

      try {
        const { getFileFromR2 } = await import('../services/r2.service');
        const file = await getFileFromR2(doc.r2Key);

        if (!file.Body) {
          details.error = 'Empty file body';
        } else {
          let buffer: Buffer;
          if (Buffer.isBuffer(file.Body)) {
            buffer = file.Body;
          } else if (typeof (file.Body as any).pipe === 'function') {
            const chunks: Buffer[] = [];
            const stream = file.Body as NodeJS.ReadableStream;
            await new Promise((resolve, reject) => {
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.on('end', resolve);
              stream.on('error', reject);
            });
            buffer = Buffer.concat(chunks);
          } else {
            buffer = Buffer.from(String(file.Body));
          }

          let text = '';
          if (doc.type === 'pdf') {
            const pdfModule = await import('pdf-parse');
            const parser = new pdfModule.PDFParse({ data: buffer });
            const result = await parser.getText();
            text = result.text || '';
          } else if (doc.type === 'docx') {
            const { default: mammoth } = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value || '';
          } else {
            text = buffer.toString('utf8');
          }

          // Validate
          const textLength = text.length;
          const nonPrintableCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
          const nonPrintableRatio = textLength > 0 ? nonPrintableCount / textLength : 0;
          const printableChars = (text.match(/[\x20-\x7E\n\r\t]/g) || []).length;
          const printableRatio = textLength > 0 ? printableChars / textLength : 0;
          const isRawPdf = text.startsWith('%PDF') || (text.includes('xref') && text.includes('endobj'));
          const isValid = textLength >= 50 && nonPrintableRatio <= 0.05 && !isRawPdf && printableRatio >= 0.7;

          details.extractionAttempt = {
            textLength,
            isValid,
            nonPrintableRatio: (nonPrintableRatio * 100).toFixed(2) + '%',
            printableRatio: (printableRatio * 100).toFixed(2) + '%',
            textPreview: text.slice(0, 200)
          };
        }
      } catch (err: any) {
        details.error = err.message;
      }

      docDetails.push(details);
    }

    res.json({
      userId,
      totalDocs: docs.length,
      docs: docDetails,
      validDocs: docDetails.filter((d: any) => d.extractionAttempt?.isValid).length,
      invalidDocs: docDetails.filter((d: any) => !d.extractionAttempt?.isValid || d.error).length
    });
  } catch (err) {
    next(err);
  }
});

// GET /knowledge/debug-users - List first 5 users (temp debugging)
// @ts-ignore - intentionally bypassing auth for debugging
router.get('/debug-users', async (_req, res) => {
  const users = await User.find({}, { email: 1, name: 1 }).limit(5);
  res.json({
    users: users.map(u => ({ id: u._id.toString(), email: u.email, name: u.name })),
    hint: 'Use /debug-test?userId=<id> to test document extraction'
  });
});

// GET /knowledge/debug-test - AUTH BYPASS for testing document extraction
// @ts-ignore - intentionally bypassing auth for debugging
router.get('/debug-test', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId query parameter' });
    }

    // Fetch all ready documents for this user
    const docs = await KnowledgeDoc.find({ userId, status: 'ready' });

    const results = [];
    for (const doc of docs) {
      const details: any = {
        id: doc._id.toString(),
        type: doc.type,
        filename: doc.filename,
        status: doc.status,
        r2Key: doc.r2Key,
        extraction: null,
        error: null
      };

      try {
        const { getFileFromR2 } = await import('../services/r2.service');
        const file = await getFileFromR2(doc.r2Key);

        if (!file.Body) {
          details.error = 'Empty file body from R2';
        } else {
          // Convert stream/body to buffer
          let buffer: Buffer;
          if (Buffer.isBuffer(file.Body)) {
            buffer = file.Body;
          } else if (typeof (file.Body as any).pipe === 'function') {
            const chunks: Buffer[] = [];
            const stream = file.Body as NodeJS.ReadableStream;
            await new Promise((resolve, reject) => {
              stream.on('data', (chunk: Buffer) => chunks.push(chunk));
              stream.on('end', resolve);
              stream.on('error', reject);
            });
            buffer = Buffer.concat(chunks);
          } else {
            buffer = Buffer.from(String(file.Body));
          }

          details.extraction = {
            bufferSize: buffer.length,
            bufferStart: buffer.slice(0, 20).toString('hex'),
            isPdf: buffer.slice(0, 4).toString() === '%PDF'
          };

          // Try to extract text
          let text = '';
          let extractError = null;

          try {
            if (doc.type === 'pdf') {
              const pdfModule = await import('pdf-parse');
              const parser = new pdfModule.PDFParse({ data: buffer });
              const result = await parser.getText();
              text = result.text || '';
            } else if (doc.type === 'docx') {
              const { default: mammoth } = await import('mammoth');
              const result = await mammoth.extractRawText({ buffer });
              text = result.value || '';
            } else {
              text = buffer.toString('utf8');
            }
          } catch (e: any) {
            extractError = e.message;
          }

          // Validate extracted text
          const textLength = text.length;
          const nonPrintableCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
          const nonPrintableRatio = textLength > 0 ? nonPrintableCount / textLength : 0;
          const printableChars = (text.match(/[\x20-\x7E\n\r\t]/g) || []).length;
          const printableRatio = textLength > 0 ? printableChars / textLength : 0;
          const isRawPdf = text.startsWith('%PDF') || (text.includes('xref') && text.includes('endobj'));
          const isValid = textLength >= 50 && nonPrintableRatio <= 0.05 && !isRawPdf && printableRatio >= 0.7;

          details.extraction.textLength = textLength;
          details.extraction.printableRatio = (printableRatio * 100).toFixed(2) + '%';
          details.extraction.nonPrintableRatio = (nonPrintableRatio * 100).toFixed(2) + '%';
          details.extraction.isRawPdf = isRawPdf;
          details.extraction.isValid = isValid;
          details.extraction.extractError = extractError;
          details.extraction.textPreview = text.slice(0, 300);
        }
      } catch (err: any) {
        details.error = err.message;
      }

      results.push(details);
    }

    res.json({
      userId,
      totalDocs: docs.length,
      docs: results,
      summary: {
        validDocs: results.filter((d: any) => d.extraction?.isValid).length,
        invalidDocs: results.filter((d: any) => d.extraction && !d.extraction.isValid).length,
        errorDocs: results.filter((d: any) => d.error).length
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
