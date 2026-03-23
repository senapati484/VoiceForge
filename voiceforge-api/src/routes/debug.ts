/**
 * Debug routes - no auth required
 * REMOVE BEFORE PRODUCTION
 */
import type { Express, Request, Response } from 'express';
import { User, KnowledgeDoc } from '../db';
import { getFileFromR2 } from '../services/r2.service';

export function addDebugRoutes(app: Express): void {
  // GET /debug/users - List users
  app.get('/debug/users', async (_req: Request, res: Response) => {
    try {
      const users = await User.find({}, { email: 1, name: 1 }).limit(5);
      res.json({
        users: users.map(u => ({ id: u._id.toString(), email: u.email, name: u.name })),
        nextStep: `Use /debug/test-extraction?userId=<ID> to test document extraction`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /debug/test-extraction - Test document extraction for user
  app.get('/debug/test-extraction', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        res.status(400).json({ error: 'Add ?userId=YOUR_USER_ID' });
        return;
      }

      console.log(`[Debug] Testing extraction for user: ${userId}`);

      // Check User
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check documents
      const docs = await KnowledgeDoc.find({ userId });
      console.log(`[Debug] Total docs: ${docs.length}`);

      const results = [];

      for (const doc of docs) {
        console.log(`[Debug] Doc: ${doc._id}, type: ${doc.type}, status: ${doc.status}, filename: ${doc.filename}`);

        const details: any = {
          id: doc._id.toString(),
          type: doc.type,
          filename: doc.filename,
          status: doc.status,
          r2Key: doc.r2Key,
          extraction: null,
          error: null
        };

        if (doc.status === 'ready' && doc.r2Key) {
          try {
            const file = await getFileFromR2(doc.r2Key);

            if (!file.Body) {
              details.error = 'Empty file body from R2';
            } else {
              // Convert to buffer
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
                isPdf: buffer.slice(0, 4).toString() === '%PDF'
              };

              // Try text extraction
              let text = '';
              let extractError = null;

              try {
                details.extraction.docType = doc.type;
                if (doc.type === 'pdf') {
                  const { PDFParse } = await import('pdf-parse');
                  details.extraction.pdfModuleKeys = Object.keys(await import('pdf-parse')).slice(0,10);
                  details.extraction.PDFParseType = typeof PDFParse;
                  const parser = new PDFParse({ data: buffer });
                  details.extraction.parserCreated = true;
                  const result = await parser.getText();
                  text = result.text || '';
                  details.extraction.resultKeys = Object.keys(result);
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

              // Validate
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
              details.extraction.textPreview = text.slice(0, 500);
            }
          } catch (err: any) {
            details.error = err.message;
          }
        }

        results.push(details);
      }

      res.json({
        userId,
        userEmail: user.email,
        totalDocs: docs.length,
        docs: results,
        summary: {
          readyDocs: results.filter((d: any) => d.status === 'ready').length,
          validDocs: results.filter((d: any) => d.extraction?.isValid).length,
          invalidDocs: results.filter((d: any) => d.extraction && !d.extraction.isValid).length,
          errorDocs: results.filter((d: any) => d.error).length
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
