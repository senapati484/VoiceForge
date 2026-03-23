import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
// Simple text splitter - splits by paragraphs and sentences
function splitText(text: string, chunkSize = 1000, overlap = 150): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = currentChunk.slice(-overlap) + sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
import { config } from '../config';
import { KnowledgeDoc } from '../db';
import { getPresignedUrl } from '../services/r2.service';
import { AppError } from '../middleware/errorHandler';

export async function ingestDocument(docId: string): Promise<void> {
  const doc = await KnowledgeDoc.findById(docId);
  if (!doc) {
    throw new AppError('Document not found', 404);
  }

  // Set status to processing
  doc.status = 'processing';
  await doc.save();

  try {
    // Step 2: Fetch document from R2
    const url = await getPresignedUrl(doc.r2Key);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Step 3: Extract text based on type
    let rawText: string;

    switch (doc.type) {
      case 'pdf':
        rawText = await extractPdfText(buffer);
        break;
      case 'docx':
        rawText = await extractDocxText(buffer);
        break;
      case 'txt':
      case 'scrape':
        rawText = buffer.toString('utf8');
        break;
      default:
        rawText = buffer.toString('utf8');
    }

    if (!rawText.trim()) {
      throw new Error('No text content found in document');
    }

    // Step 4: Split into chunks
    const chunkTexts = splitText(rawText, 1000, 150);

    // Create document objects for Pinecone
    const chunks = chunkTexts.map(text => ({
      pageContent: text,
      metadata: { docId: doc._id.toString(), userId: doc.userId.toString() }
    }));

    if (chunks.length === 0) {
      throw new Error('No chunks generated from document');
    }

    // If RAG stack is disabled, still mark document as ready.
    if (!config.ragEnabled) {
      doc.status = 'ready';
      doc.chunkCount = chunks.length;
      doc.pineconeNS = undefined;
      doc.errorMsg = undefined;
      await doc.save();
      return;
    }

    // Step 5: Index in Pinecone with Gemini embeddings (768 dimensions)
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: config.gemini.apiKey!,
      model: 'text-embedding-004'
    });

    const pc = new Pinecone({ apiKey: config.pinecone.apiKey! });
    const index = pc.Index(config.pinecone.index!);

    // Create vectors manually for more control
    const vectors = await Promise.all(
      chunks.map(async (chunk, i) => {
        const embedding = await embeddings.embedQuery(chunk.pageContent);
        return {
          id: `${doc._id}-${i}`,
          values: embedding,
          metadata: {
            ...chunk.metadata,
            text: chunk.pageContent
          }
        };
      })
    );

    await index.namespace(doc.userId.toString()).upsert(vectors);

    // Step 6: Update document status
    doc.status = 'ready';
    doc.chunkCount = chunks.length;
    doc.pineconeNS = doc.userId.toString();
    await doc.save();

  } catch (err) {
    // Update error status
    doc.status = 'error';
    doc.errorMsg = err instanceof Error ? err.message : 'Unknown error';
    await doc.save();
    throw err;
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text;
  } catch {
    // Fallback: try to extract any readable text
    return buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  // For DOCX, extract text from XML
  try {
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch {
    // Fallback
    return buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
  }
}
