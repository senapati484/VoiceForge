import { config } from '../config';
import { Agent, type IAgent, KnowledgeDoc, type IKnowledgeDoc } from '../db';
import { getFileFromR2 } from './r2.service';
import { extractWithGemini, isGeminiAvailable } from './gemini.service';
import {
  compressKnowledgeFile,
  expandCompactContext
} from './compactContext.service';
import type {
  KnowledgeFile,
  KnowledgeContext,
  CompactContextV2
} from '../types/compactContext';
import { isCompactContext } from '../types/compactContext';

// Re-export types for backward compatibility
export type { KnowledgeFile, KnowledgeContext, CompactContextV2 };

// In-memory cache for compiled contexts
const contextCache = new Map<string, { context: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Check if text is valid (not binary garbage)
 */
function isValidText(text: string): boolean {
  if (!text || text.length < 50) {
    console.log(`[ContextBuilder] Text too short: ${text?.length || 0} chars`);
    return false;
  }

  // Check for excessive non-printable characters
  const nonPrintableCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
  const nonPrintableRatio = nonPrintableCount / text.length;
  if (nonPrintableRatio > 0.05) { // Relaxed from 0.1
    console.log(`[ContextBuilder] Too many non-printable chars: ${(nonPrintableRatio * 100).toFixed(1)}% (${nonPrintableCount} chars)`);
    return false;
  }

  // Check for raw PDF binary (not extracted text)
  // If we see PDF header or xref table markers, it's likely raw PDF binary
  if (text.startsWith('%PDF') || (text.includes('xref') && text.includes('endobj'))) {
    console.log('[ContextBuilder] Text appears to be raw PDF binary, not extracted');
    return false;
  }

  // Check for reasonable word characters ratio (allow punctuation, etc.)
  const printableChars = (text.match(/[\x20-\x7E\n\r\t]/g) || []).length;
  const printableRatio = printableChars / text.length;
  if (printableRatio < 0.7) {
    console.log(`[ContextBuilder] Too many non-printable chars: ${(printableRatio * 100).toFixed(1)}% printable (${printableChars}/${text.length})`);
    return false;
  }

  console.log(`[ContextBuilder] Text validation passed: ${text.length} chars, ${(printableRatio * 100).toFixed(1)}% printable`);
  return true;
}

/**
 * Convert AWS S3 Body to Buffer
 */
async function streamToBuffer(body: any): Promise<Buffer> {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  // Handle stream
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    body.on('data', (chunk: Buffer) => chunks.push(chunk));
    body.on('end', () => resolve(Buffer.concat(chunks)));
    body.on('error', reject);
  });
}

/**
 * Extract text from a KnowledgeDoc by fetching from R2 and parsing based on type
 */
async function extractTextFromDoc(doc: IKnowledgeDoc): Promise<string> {
  try {
    console.log(`[ContextBuilder] ====== START extractTextFromDoc for doc ${doc._id} ======`);
    console.log(`[ContextBuilder] Doc type: ${doc.type}, filename: ${doc.filename}, r2Key: ${doc.r2Key}`);

    const file = await getFileFromR2(doc.r2Key);
    console.log(`[ContextBuilder] File fetched from R2: ${!!file}`);
    console.log(`[ContextBuilder] File.Body exists: ${!!file.Body}`);
    console.log(`[ContextBuilder] File.ContentType: ${file.ContentType}`);
    console.log(`[ContextBuilder] File.ContentLength: ${file.ContentLength}`);

    if (!file.Body) {
      console.error(`[ContextBuilder] ERROR: Empty file body for doc ${doc._id}`);
      return '';
    }

    // Convert body to buffer
    const buffer = await streamToBuffer(file.Body);
    console.log(`[ContextBuilder] Buffer created: ${buffer.length} bytes`);
    console.log(`[ContextBuilder] First 20 bytes (hex): ${buffer.slice(0, 20).toString('hex')}`);
    console.log(`[ContextBuilder] First 20 bytes (ascii): ${buffer.slice(0, 20).toString('ascii')}`);

    let text = '';
    console.log(`[ContextBuilder] Switching on doc.type: ${doc.type}`);
    switch (doc.type) {
      case 'pdf':
        console.log('[ContextBuilder] Extracting PDF text...');
        text = await extractPdfText(buffer);
        break;
      case 'docx':
        console.log('[ContextBuilder] Extracting DOCX text...');
        text = await extractDocxText(buffer);
        break;
      case 'txt':
      case 'scrape':
        console.log('[ContextBuilder] Converting buffer to UTF8 string for txt/scrape...');
        text = buffer.toString('utf8');
        break;
      default:
        console.log(`[ContextBuilder] Unknown type "${doc.type}", trying UTF8 conversion...`);
        text = buffer.toString('utf8');
    }

    console.log(`[ContextBuilder] Raw text extracted: ${text.length} chars`);
    console.log(`[ContextBuilder] Raw text preview: ${text.slice(0, 100).replace(/\n/g, '\\n')}`);

    // Validate extracted text
    const isValid = isValidText(text);
    console.log(`[ContextBuilder] isValidText result: ${isValid}`);

    if (!isValid) {
      console.error(`[ContextBuilder] ERROR: Text validation failed for doc ${doc._id}`);
      console.error(`[ContextBuilder] Text sample: ${text.slice(0, 500)}`);
      return '';
    }

    console.log(`[ContextBuilder] ====== SUCCESS extractTextFromDoc for doc ${doc._id}: ${text.length} chars ======`);
    return text;
  } catch (err: any) {
    console.error(`[ContextBuilder] FAILED extractTextFromDoc for doc ${doc._id}:`, err);
    console.error('[ContextBuilder] Error stack:', err.stack);
    return '';
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Check if it's actually a PDF
    const header = buffer.slice(0, 8).toString('ascii');
    const hexHeader = buffer.slice(0, 4).toString('hex');
    console.log(`[ContextBuilder] PDF header (ascii): ${header}`);
    console.log(`[ContextBuilder] PDF header (hex): ${hexHeader}`);
    console.log(`[ContextBuilder] Buffer length: ${buffer.length} bytes`);

    if (!header.startsWith('%PDF')) {
      console.error('[ContextBuilder] File is not a valid PDF (missing %PDF header)');
      console.error(`[ContextBuilder] First 100 bytes: ${buffer.slice(0, 100).toString('hex')}`);
      return '';
    }

    console.log(`[ContextBuilder] Calling pdf-parse...`);

    const pdfModule = await import('pdf-parse');
    console.log(`[ContextBuilder] pdf-parse module imported, type: ${typeof pdfModule}`);
    console.log(`[ContextBuilder] pdf-parse module keys: ${Object.keys(pdfModule).join(', ')}`);

    const { PDFParse } = pdfModule;
    console.log(`[ContextBuilder] PDFParse type: ${typeof PDFParse}`);

    if (!PDFParse) {
      console.error('[ContextBuilder] PDFParse is undefined!');
      return '';
    }

    const parser = new PDFParse({ data: buffer });
    console.log(`[ContextBuilder] Parser created, calling getText()...`);

    const data = await parser.getText();
    console.log(`[ContextBuilder] getText() returned, type: ${typeof data}`);
    console.log(`[ContextBuilder] data.text exists: ${!!data.text}`);
    console.log(`[ContextBuilder] data.text length: ${data.text?.length || 0}`);

    if (!data.text || data.text.length < 50) {
      console.error('[ContextBuilder] PDF extraction returned empty or very short text');
      return '';
    }

    // Clean the extracted text - remove PDF artifacts
    let text = data.text
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
      .trim();

    console.log(`[ContextBuilder] After initial cleaning: ${text.length} chars`);
    console.log(`[ContextBuilder] Text preview (first 200 chars): ${text.slice(0, 200).replace(/\n/g, '\\n')}`);

    // Additional cleaning for PDF artifacts
    text = text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();

    console.log(`[ContextBuilder] Final cleaned PDF text length: ${text.length}`);

    // If cleaned text is too short, return empty
    if (text.length < 50) {
      console.error('[ContextBuilder] Cleaned text too short');
      return '';
    }

    return text;
  } catch (err: any) {
    console.error('[ContextBuilder] PDF extraction failed:', err);
    console.error('[ContextBuilder] Error stack:', err.stack);
    return '';
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // Check if it's actually a DOCX (ZIP file starting with PK)
    const header = buffer.slice(0, 4).toString('hex');
    console.log(`[ContextBuilder] DOCX header (hex): ${header}`);

    if (header !== '504b0304') {
      console.error('[ContextBuilder] File is not a valid DOCX (missing PK header)');
      console.error(`[ContextBuilder] First 100 bytes: ${buffer.slice(0, 100).toString('hex')}`);
      return '';
    }

    console.log(`[ContextBuilder] Calling mammoth extractRawText...`);
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });

    console.log(`[ContextBuilder] Mammoth result length: ${result.value?.length || 0}`);
    console.log(`[ContextBuilder] Mammoth messages: ${result.messages?.length || 0} messages`);

    if (!result.value || result.value.length < 50) {
      console.error('[ContextBuilder] DOCX extraction returned empty or very short text');
      return '';
    }

    console.log(`[ContextBuilder] DOCX text preview (first 200 chars): ${result.value.slice(0, 200).replace(/\n/g, '\\n')}`);

    return result.value;
  } catch (err: any) {
    console.error('[ContextBuilder] DOCX extraction failed:', err);
    console.error('[ContextBuilder] Error stack:', err.stack);
    return '';
  }
}

/**
 * Build a KnowledgeFile from all user's documents using AI-powered extraction
 */
export async function buildKnowledgeFile(userId: string): Promise<KnowledgeFile> {
  console.log(`[ContextBuilder] Building knowledge file for user ${userId}`);

  // Fetch all ready documents for this user
  const docs = await KnowledgeDoc.find({
    userId,
    status: 'ready'
  });

  console.log(`[ContextBuilder] Found ${docs.length} ready documents`);

  if (docs.length === 0) {
    console.log('[ContextBuilder] No documents found, returning empty template');
    // Return empty template if no documents
    return {
      businessSummary: '',
      keyProducts: [],
      commonQA: [],
      importantFacts: [],
      escalationTriggers: ['Customer requests human agent', 'Complex technical issue beyond scope']
    };
  }

  // Log document types
  docs.forEach(doc => {
    console.log(`[ContextBuilder] Doc ${doc._id}: type=${doc.type}, filename=${doc.filename || 'N/A'}, sourceUrl=${doc.sourceUrl || 'N/A'}`);
  });

  // Extract text from all documents with timeout per document
  const docTexts: { type: string; text: string; source?: string }[] = [];
  const MAX_DOC_TIMEOUT = 10000; // 10 seconds per document max

  for (const doc of docs) {
    console.log(`[ContextBuilder] Processing doc ${doc._id} with ${MAX_DOC_TIMEOUT}ms timeout...`);

    try {
      const text = await Promise.race([
        extractTextFromDoc(doc),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Document extraction timeout')), MAX_DOC_TIMEOUT)
        )
      ]);

      if (text.trim()) {
        docTexts.push({
          type: doc.type,
          text: text.slice(0, 20000), // Limit each doc to 20k chars (reduced from 50k)
          source: doc.filename || doc.sourceUrl
        });
        console.log(`[ContextBuilder] Added doc ${doc._id} to extraction list (${text.length} chars)`);
      } else {
        console.error(`[ContextBuilder] Skipping doc ${doc._id} - no valid text extracted`);
      }
    } catch (timeoutErr: any) {
      console.error(`[ContextBuilder] Doc ${doc._id} extraction failed/timeout:`, timeoutErr.message);
    }
  }

  console.log(`[ContextBuilder] Successfully extracted text from ${docTexts.length}/${docs.length} documents`);

  // If no valid text was extracted, return empty template
  if (docTexts.length === 0) {
    console.error('[ContextBuilder] No valid text extracted from any documents');
    return {
      businessSummary: 'No valid content could be extracted from the uploaded documents.',
      keyProducts: [],
      commonQA: [],
      importantFacts: ['Document extraction failed - please ensure documents contain readable text'],
      escalationTriggers: ['Customer requests human agent', 'Complex technical issue beyond scope']
    };
  }

  // Combine all text
  const combinedText = docTexts.map(d => d.text).join('\n\n---\n\n');
  console.log(`[ContextBuilder] Combined text length: ${combinedText.length} characters`);

  // Use AI to extract structured information
  const knowledgeFile = await extractKnowledgeWithAI(combinedText);

  // Log the final result
  console.log('[ContextBuilder] Final knowledge file:', {
    businessSummaryLength: knowledgeFile.businessSummary?.length || 0,
    keyProductsCount: knowledgeFile.keyProducts?.length || 0,
    commonQACount: knowledgeFile.commonQA?.length || 0,
    importantFactsCount: knowledgeFile.importantFacts?.length || 0
  });

  return knowledgeFile;
}

/**
 * Extract structured knowledge from text using AI (Groq)
 */
async function extractKnowledgeWithAI(text: string): Promise<KnowledgeFile> {
  console.log(`[ContextBuilder] ====== START extractKnowledgeWithAI ======`);
  console.log(`[ContextBuilder] Input text length: ${text.length}`);
  console.log(`[ContextBuilder] Input text preview (first 500 chars): ${text.slice(0, 500).replace(/\n/g, '\\n')}`);

  // Final validation - ensure we're not sending binary/garbage to AI
  const isValid = isValidText(text);
  console.log(`[ContextBuilder] Final validation result: ${isValid}`);

  if (!isValid) {
    console.error('[ContextBuilder] Text failed final validation before AI extraction');
    return {
      businessSummary: 'Document content could not be properly extracted. Please ensure uploaded files contain readable text.',
      keyProducts: [],
      commonQA: [],
      importantFacts: ['Document extraction issue - files may be corrupted or password protected'],
      escalationTriggers: ['Customer requests human agent', 'Document content unclear']
    };
  }

  // If no Groq API key, use fallback extraction
  console.log(`[ContextBuilder] Checking Groq API key: ${config.groq.apiKey ? 'EXISTS' : 'MISSING'}`);
  if (!config.groq.apiKey) {
    console.log('[ContextBuilder] No Groq API key, using fallback extraction');
    return fallbackKnowledgeExtraction(text);
  }

  // Provider selection based on config
  const provider = config.context.provider;
  console.log(`[ContextBuilder] Using provider: ${provider}`);

  // Try Gemini first if configured and available
  if (provider === 'gemini' && isGeminiAvailable()) {
    console.log('[ContextBuilder] Using Gemini for extraction');
    try {
      return await extractWithGemini(Buffer.from(text), 'text/plain');
    } catch (geminiError: any) {
      // Check if it's a rate limit error
      if (geminiError.message?.includes('429') ||
          geminiError.message?.includes('quota') ||
          geminiError.message?.includes('exceeded')) {
        console.warn('[ContextBuilder] Gemini rate limit exceeded, falling back to Groq');
        console.warn('[ContextBuilder] Gemini error:', geminiError.message);
      } else {
        console.warn('[ContextBuilder] Gemini extraction failed, falling back to Groq');
        console.warn('[ContextBuilder] Gemini error:', geminiError.message);
      }
      // Continue to Groq fallback
    }
  }

  // Fallback to Groq (either by config or Gemini failure)
  console.log('[ContextBuilder] Using Groq for extraction');
  return extractWithGroq(text);
}

/**
 * Extract knowledge using Groq
 */
async function extractWithGroq(text: string): Promise<KnowledgeFile> {
  try {
    const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const model = config.groq.contextModel || config.groq.model || 'llama-3.3-70b-versatile';
    console.log(`[ContextBuilder] Using Groq model: ${model}`);

    // Truncate text for AI processing (keep first 4000 chars which is roughly 1000 tokens)
    const truncatedText = text.slice(0, 4000);
    console.log(`[ContextBuilder] Truncated text to ${truncatedText.length} chars for AI`);
    console.log(`[ContextBuilder] Truncated text preview: ${truncatedText.slice(0, 300).replace(/\n/g, '\\n')}`);

    const systemPrompt = `You are a knowledge extraction assistant. Analyze the provided text and extract structured business information. Return ONLY valid JSON.

REQUIRED JSON SCHEMA:
{
  "businessSummary": "2-3 sentence summary of what this business/organization does",
  "keyProducts": [
    {
      "name": "Product/service name extracted from text",
      "price": "Price if mentioned, otherwise omit",
      "description": "Brief description from text",
      "features": ["feature1", "feature2"]
    }
  ],
  "commonQA": [
    {
      "question": "What services do you offer?",
      "answer": "Answer based on text content"
    }
  ],
  "importantFacts": ["Fact 1", "Fact 2", "Fact 3"],
  "escalationTriggers": ["When to transfer to human"]
}

EXTRACTION RULES:
1. businessSummary: MUST create a summary from the text. If text is unclear, infer from context.
2. keyProducts: Extract ANY products/services mentioned. If none explicit, infer from business type. Include 2-5 items minimum.
3. commonQA: Generate 3-5 realistic Q&A pairs that customers might ask based on the content.
4. importantFacts: Extract contact info, hours, policies, or key business details. Minimum 3 items.
5. escalationTriggers: ALWAYS include at least: "Customer requests human agent", "Question outside scope", "Complaint or escalation"

CRITICAL: Do not return empty arrays. Infer and generate content based on the text provided. Always return valid JSON only, no markdown.`;

    console.log(`[ContextBuilder] Sending request to Groq API...`);
    console.log(`[ContextBuilder] API URL: ${GROQ_API_URL}`);
    console.log(`[ContextBuilder] Model: ${model}`);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract structured knowledge from this text:\n\n${truncatedText}` }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    console.log(`[ContextBuilder] Groq API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ContextBuilder] Groq API error: ${response.status}`, errorText);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json() as { choices?: [{ message?: { content?: string } }] };
    console.log(`[ContextBuilder] Response data keys: ${Object.keys(data).join(', ')}`);
    console.log(`[ContextBuilder] Choices count: ${data.choices?.length || 0}`);

    const content = data.choices?.[0]?.message?.content || '';

    console.log(`[ContextBuilder] AI raw response length: ${content.length}`);
    console.log(`[ContextBuilder] AI raw response FULL:\n${content}`);

    // Parse JSON from response (handle potential markdown code blocks)
    console.log(`[ContextBuilder] Parsing JSON from response...`);
    const jsonMatch = content.match(/```json\n?([\s\S]*?)```/) || content.match(/```\n?([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    console.log(`[ContextBuilder] Extracted JSON string length: ${jsonStr.length}`);
    console.log(`[ContextBuilder] Extracted JSON string:\n${jsonStr.slice(0, 1000)}`);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr.trim());
      console.log(`[ContextBuilder] JSON parsed successfully`);
    } catch (parseErr: any) {
      console.error('[ContextBuilder] JSON parse failed:', parseErr.message);
      console.error('[ContextBuilder] Attempted to parse:', jsonStr.slice(0, 1000));
      throw new Error('Failed to parse AI response as JSON');
    }

    console.log('[ContextBuilder] Parsed result fields:', {
      businessSummary: parsed.businessSummary?.slice(0, 100),
      keyProductsCount: parsed.keyProducts?.length || 0,
      commonQACount: parsed.commonQA?.length || 0,
      importantFactsCount: parsed.importantFacts?.length || 0,
      escalationTriggersCount: parsed.escalationTriggers?.length || 0
    });

    // Validate and ensure required fields
    const result = {
      businessSummary: parsed.businessSummary || '',
      keyProducts: Array.isArray(parsed.keyProducts) ? parsed.keyProducts.slice(0, 10) : [],
      commonQA: Array.isArray(parsed.commonQA) ? parsed.commonQA.slice(0, 10) : [],
      importantFacts: Array.isArray(parsed.importantFacts) ? parsed.importantFacts.slice(0, 10) : [],
      escalationTriggers: Array.isArray(parsed.escalationTriggers)
        ? parsed.escalationTriggers.slice(0, 5)
        : ['Customer requests human agent', 'Complex issue beyond scope']
    };

    console.log('[ContextBuilder] ====== SUCCESS extractKnowledgeWithAI ======');
    console.log('[ContextBuilder] Final result:', {
      businessSummaryLength: result.businessSummary?.length,
      keyProductsCount: result.keyProducts?.length,
      commonQACount: result.commonQA?.length,
      importantFactsCount: result.importantFacts?.length,
      escalationTriggersCount: result.escalationTriggers?.length
    });

    return result;
  } catch (err: any) {
    console.error('[ContextBuilder] AI extraction failed, using fallback:', err);
    console.error('[ContextBuilder] Error stack:', err.stack);
    return fallbackKnowledgeExtraction(text);
  }
}

/**
 * Fallback knowledge extraction without AI - uses pattern matching
 */
function fallbackKnowledgeExtraction(text: string): KnowledgeFile {
  console.log(`[ContextBuilder] Using fallback extraction for ${text.length} chars`);

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  console.log(`[ContextBuilder] Split into ${sentences.length} sentences`);

  // Extract sentences that look like key facts (contain numbers, prices, or important keywords)
  const importantFacts = sentences
    .filter(s =>
      /\$\d|price|cost|contact|phone|email|hours|location|policy|guarantee|warranty/i.test(s)
    )
    .slice(0, 5);

  // Extract potential Q&A pairs from FAQ-like patterns
  const commonQA: Array<{ question: string; answer: string }> = [];
  const qaPatterns = text.match(/(?:Q:|Question:|FAQ[:\s]|What\s|How\s|When\s|Where\s|Why\s)[^.?]*[.?]/gi);
  if (qaPatterns) {
    for (let i = 0; i < Math.min(qaPatterns.length, 5); i++) {
      commonQA.push({
        question: qaPatterns[i].trim(),
        answer: 'Please refer to the documentation for more details.'
      });
    }
  }

  // Create a summary from first few sentences
  const summarySentences = sentences.slice(0, 3);
  const businessSummary = summarySentences.join('. ') + '.';

  const result = {
    businessSummary,
    keyProducts: [],
    commonQA,
    importantFacts,
    escalationTriggers: [
      'Customer requests human agent',
      'Complex technical issue beyond scope',
      'Billing or payment dispute',
      'Legal or compliance matter'
    ]
  };

  console.log(`[ContextBuilder] Fallback extraction result:`, {
    businessSummary: result.businessSummary?.slice(0, 100),
    keyProductsCount: result.keyProducts?.length,
    commonQACount: result.commonQA?.length,
    importantFactsCount: result.importantFacts?.length,
    escalationTriggersCount: result.escalationTriggers?.length
  });

  return result;
}

interface BuildAgentKnowledgeFileInput {
  agentType: string;
  description: string;
  callObjective: string;
  userContext?: KnowledgeFile | null;
}

/**
 * Build agent-specific knowledge file combining agent description with user context
 */
export async function buildAgentKnowledgeFile({
  agentType,
  description,
  callObjective,
  userContext
}: BuildAgentKnowledgeFileInput): Promise<KnowledgeFile> {
  // Start with agent-specific information
  const agentSummary = `${agentType.toUpperCase()} Agent: ${callObjective}\n\nDescription: ${description}`;

  // If we have user context, merge it intelligently
  if (userContext) {
    return {
      businessSummary: userContext.businessSummary || agentSummary,
      keyProducts: userContext.keyProducts || [],
      commonQA: userContext.commonQA || [],
      importantFacts: [
        `Agent Role: ${agentType}`,
        `Call Objective: ${callObjective}`,
        ...(userContext.importantFacts || [])
      ],
      escalationTriggers: userContext.escalationTriggers?.length
        ? userContext.escalationTriggers
        : [
            'Customer requests human agent',
            'Complex technical issue beyond scope',
            'Billing or payment dispute',
            'Legal or compliance matter'
          ]
    };
  }

  // Return minimal knowledge file if no user context
  return {
    businessSummary: agentSummary,
    keyProducts: [],
    commonQA: [],
    importantFacts: [`Agent Role: ${agentType}`, `Call Objective: ${callObjective}`],
    escalationTriggers: [
      'Customer requests human agent',
      'Complex technical issue beyond scope'
    ]
  };
}

// Compact prompt templates for faster processing
const PROMPT_TEMPLATES = {
  compact: (agent: IAgent, knowledge?: KnowledgeFile) => {
    const parts: string[] = [];

    // Identity (always include)
    parts.push(`You are ${agent.name}, ${agent.agentType} agent for ${agent.businessName}.`);
    parts.push(`Goal: ${agent.callObjective}`);

    // Knowledge (if available)
    if (knowledge?.businessSummary) {
      parts.push(`\nAbout: ${knowledge.businessSummary.slice(0, 200)}`);
    }

    if (knowledge?.keyProducts?.length) {
      const products = knowledge.keyProducts
        .slice(0, 3)
        .map(p => `• ${p.name}: ${p.description.slice(0, 60)}`)
        .join('\n');
      parts.push(`\nProducts:\n${products}`);
    }

    if (knowledge?.commonQA?.length) {
      const qa = knowledge.commonQA
        .slice(0, 3)
        .map(q => `Q: ${q.question}\nA: ${q.answer.slice(0, 80)}`)
        .join('\n');
      parts.push(`\nFAQ:\n${qa}`);
    }

    if (knowledge?.escalationTriggers?.length) {
      parts.push(`\nEscalate if: ${knowledge.escalationTriggers.slice(0, 3).join(', ')}`);
    }

    // Voice-specific rules (always include)
    parts.push(`\nRules: Keep answers 1-2 sentences. Tone: ${agent.tone}.`);
    parts.push(`If unsure: "I don't have that info, but I can connect you with our team."`);

    return parts.join('\n');
  },

  // Even more minimal for fastest response
  minimal: (agent: IAgent, knowledge?: KnowledgeFile) => {
    return `You are ${agent.name}, ${agent.agentType} agent for ${agent.businessName}.
Goal: ${agent.callObjective.slice(0, 100)}${knowledge?.businessSummary ? `\nAbout: ${knowledge.businessSummary.slice(0, 150)}` : ''}
Keep answers under 15 words. Tone: ${agent.tone}.`;
  }
};

/**
 * Build optimized system prompt for voice calls
 * Uses caching and minimal prompt size for fastest response
 */
export function buildSystemPrompt(
  agent: IAgent,
  knowledge?: KnowledgeFile | null,
  mode: 'compact' | 'minimal' = 'compact'
): string {
  const cacheKey = `${agent._id}-${mode}-${knowledge ? 'k' : 'nk'}`;

  // Check cache
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  // Build new prompt
  const template = PROMPT_TEMPLATES[mode];
  const context = template(agent, knowledge || undefined);

  // Cache it
  contextCache.set(cacheKey, { context, timestamp: Date.now() });

  return context;
}

/**
 * Build combined prompt with agent + business context
 * Optimized for size and speed
 * Supports both KnowledgeFile (legacy) and CompactContextV2
 */
export function buildCombinedSystemPrompt(
  agent: IAgent,
  businessContext?: KnowledgeContext | null
): string {
  // NEW: Handle compact context format
  if (businessContext && isCompactContext(businessContext)) {
    return buildPromptFromCompact(agent, businessContext);
  }

  // Legacy KnowledgeFile handling
  const cacheKey = `combined-${agent._id}-${businessContext ? 'bc' : 'nbc'}`;

  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  const agentKnowledge = agent.knowledgeFile as KnowledgeFile | undefined;
  const bc = businessContext as KnowledgeFile | null;

  // Build compact combined context
  const parts: string[] = [];

  // Identity
  parts.push(`You are ${agent.name}, ${agent.agentType} agent for ${agent.businessName}.`);
  parts.push(`Goal: ${agent.callObjective}`);

  // Agent-specific knowledge
  if (agentKnowledge?.businessSummary) {
    parts.push(`\nYour role: ${agentKnowledge.businessSummary.slice(0, 150)}`);
  }

  // Business knowledge (user-level)
  if (bc?.businessSummary) {
    parts.push(`\nCompany: ${bc.businessSummary.slice(0, 150)}`);
  }

  // Combined products/services
  const allProducts = [
    ...(agentKnowledge?.keyProducts?.slice(0, 2) || []),
    ...(bc?.keyProducts?.slice(0, 2) || [])
  ];
  if (allProducts.length) {
    const products = allProducts
      .map(p => `• ${p.name}${p.price ? ` (${p.price})` : ''}: ${p.description.slice(0, 50)}`)
      .join('\n');
    parts.push(`\nServices:\n${products}`);
  }

  // Combined FAQ
  const allQA = [
    ...(agentKnowledge?.commonQA?.slice(0, 2) || []),
    ...(bc?.commonQA?.slice(0, 2) || [])
  ];
  if (allQA.length) {
    const qa = allQA
      .map(q => `Q: ${q.question}\nA: ${q.answer.slice(0, 60)}`)
      .join('\n');
    parts.push(`\nFAQ:\n${qa}`);
  }

  // Escalation
  const allEscalations = [
    ...(agentKnowledge?.escalationTriggers || []),
    ...(bc?.escalationTriggers || [])
  ];
  if (allEscalations.length) {
    parts.push(`\nEscalate: ${allEscalations.slice(0, 3).join(', ')}`);
  }

  // Voice rules
  parts.push(`\nRules: 1-2 sentence answers. Tone: ${agent.tone}.`);
  parts.push(`If unsure: "I don't have that, but I can connect you with our team."`);

  const context = parts.join('\n');
  contextCache.set(cacheKey, { context, timestamp: Date.now() });

  return context;
}

/**
 * Build prompt from compact context
 * Efficient expansion of compressed format
 */
function buildPromptFromCompact(
  agent: IAgent,
  compact: CompactContextV2
): string {
  const cacheKey = `compact-${agent._id}-${compact.a.slice(0, 20)}`;

  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  // Use the expand function from compactContext.service
  const prompt = expandCompactContext(compact, {
    name: agent.name,
    agentType: agent.agentType,
    businessName: agent.businessName,
    callObjective: agent.callObjective
  });

  contextCache.set(cacheKey, { context: prompt, timestamp: Date.now() });
  return prompt;
}

/**
 * Pre-compile contexts for agents to speed up webhook response
 */
export async function precompileAgentContexts(userId: string): Promise<void> {
  try {
    const agents = await Agent.find({ userId });
    for (const agent of agents) {
      // Pre-build and cache contexts
      buildSystemPrompt(agent, null, 'compact');
      buildSystemPrompt(agent, null, 'minimal');
      if (agent.knowledgeFile) {
        buildSystemPrompt(agent, agent.knowledgeFile as KnowledgeFile, 'compact');
      }
    }
    console.log(`[Context] Precompiled ${agents.length} agents for user ${userId}`);
  } catch (err) {
    console.error('[Context] Failed to precompile:', err);
  }
}

/**
 * Clear cache for an agent (call when agent is updated)
 */
export function clearAgentContextCache(agentId: string): void {
  for (const key of contextCache.keys()) {
    if (key.includes(agentId.toString())) {
      contextCache.delete(key);
    }
  }
}

/**
 * Get cache stats for monitoring
 */
export function getContextCacheStats(): { size: number; entries: string[] } {
  return {
    size: contextCache.size,
    entries: Array.from(contextCache.keys())
  };
}

// Legacy exports for backward compatibility
export function buildPersonaPrompt(agent: IAgent): string {
  const guidelines: Record<string, { do: string[]; dont: string[] }> = {
    marketing: {
      do: ['introduce clearly', 'highlight benefits', 'handle objections'],
      dont: ['pressure caller', 'make false claims']
    },
    support: {
      do: ['acknowledge empathetically', 'gather details', 'confirm resolution'],
      dont: ['blame user', 'promise timelines']
    },
    sales: {
      do: ['qualify interest', 'explain value', 'suggest next step'],
      dont: ['pressure', 'exaggerate']
    },
    tech: {
      do: ['ask error details', 'provide steps', 'follow up'],
      dont: ['assume level', 'use jargon']
    }
  };

  const g = guidelines[agent.agentType];
  if (!g) return '';

  return `DO:\n${g.do.map(x => `• ${x}`).join('\n')}\n\nDON'T:\n${g.dont.map(x => `• ${x}`).join('\n')}`;
}

// Re-export for compatibility
export type { IAgent };
export { config };
