/**
 * Gemini Service
 * Handles document extraction using Gemini 2.5 Flash
 * Supports native multimodal PDF processing
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../config';
import type { KnowledgeFile } from '../types/compactContext';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(config.gemini.apiKey || '');

/**
 * Extraction prompt for Gemini
 * Optimized for structured JSON output
 */
const EXTRACTION_PROMPT = `You are a knowledge extraction assistant. Analyze the provided document and extract structured business information.

Return ONLY valid JSON matching this exact schema:

{
  "businessSummary": "2-3 sentence summary of what this business/organization does",
  "keyProducts": [
    {
      "name": "Product/service name",
      "price": "Price if mentioned, otherwise omit this field",
      "description": "Brief description",
      "features": ["feature1", "feature2"]
    }
  ],
  "commonQA": [
    {
      "question": "Common customer question",
      "answer": "Answer based on document content"
    }
  ],
  "importantFacts": ["Fact 1", "Fact 2", "Fact 3"],
  "escalationTriggers": ["When to transfer to human"]
}

EXTRACTION RULES:
1. businessSummary: MUST create a summary. If unclear, infer from context. Max 200 chars.
2. keyProducts: Extract ANY products/services mentioned. Include 2-5 items. If none explicit, infer from business type.
3. commonQA: Generate 3-5 realistic Q&A pairs customers might ask. Be specific to the business.
4. importantFacts: Extract contact info, hours, policies, key details. Minimum 3 items.
5. escalationTriggers: ALWAYS include: "Customer requests human agent", "Question outside scope", "Complaint or escalation"
6. If the document contains images, diagrams, or tables, describe their key information.

CRITICAL: Return ONLY the JSON object. No markdown, no explanations.`;

/**
 * Extract structured knowledge from a document using Gemini 2.5 Flash
 * Supports native PDF/multimodal input
 *
 * @param buffer - File buffer (PDF, text, etc.)
 * @param mimeType - MIME type of the file
 * @returns Extracted KnowledgeFile structure
 */
export async function extractWithGemini(
  buffer: Buffer,
  mimeType: string
): Promise<KnowledgeFile> {
  if (!config.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  console.log(`[Gemini] Starting extraction with model: ${config.gemini.extractionModel}`);
  console.log(`[Gemini] File size: ${buffer.length} bytes, type: ${mimeType}`);

  const model = genAI.getGenerativeModel({
    model: config.gemini.extractionModel || 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  // Prepare content based on mime type
  let result;
  const startTime = Date.now();

  try {
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      // Multimodal: Send as inline data
      const base64Data = buffer.toString('base64');

      result = await model.generateContent([
        EXTRACTION_PROMPT,
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
      ]);
    } else {
      // Text-based: Send as text
      const textContent = buffer.toString('utf-8');
      result = await model.generateContent(`${EXTRACTION_PROMPT}\n\nDocument content:\n${textContent.slice(0, 50000)}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Gemini] Extraction completed in ${duration}ms`);

    const response = result.response;
    const text = response.text();

    // Parse JSON from response
    return parseExtractionResponse(text);
  } catch (error: any) {
    console.error('[Gemini] Extraction failed:', error.message);
    throw new Error(`Gemini extraction failed: ${error.message}`);
  }
}

/**
 * Parse JSON response from Gemini
 * Handles potential markdown code blocks
 */
function parseExtractionResponse(text: string): KnowledgeFile {
  console.log(`[Gemini] Raw response length: ${text.length}`);

  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```json\n?([\s\S]*?)```/) ||
                    text.match(/```\n?([\s\S]*?)```/);

  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr.trim()) as KnowledgeFile;

    // Validate required fields
    if (!parsed.businessSummary) {
      throw new Error('Missing businessSummary in response');
    }

    // Ensure arrays exist
    parsed.keyProducts = parsed.keyProducts || [];
    parsed.commonQA = parsed.commonQA || [];
    parsed.importantFacts = parsed.importantFacts || [];
    parsed.escalationTriggers = parsed.escalationTriggers || [
      'Customer requests human agent',
      'Question outside scope',
      'Complaint or escalation'
    ];

    console.log(`[Gemini] Parsed successfully:`);
    console.log(`  - Summary: ${parsed.businessSummary.slice(0, 50)}...`);
    console.log(`  - Products: ${parsed.keyProducts.length}`);
    console.log(`  - Q&A pairs: ${parsed.commonQA.length}`);
    console.log(`  - Facts: ${parsed.importantFacts.length}`);

    return parsed;
  } catch (parseError: any) {
    console.error('[Gemini] JSON parse failed:', parseError.message);
    console.error('[Gemini] Attempted to parse:', jsonStr.slice(0, 500));
    throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
  }
}

/**
 * Check if Gemini is configured and available
 */
export function isGeminiAvailable(): boolean {
  return !!config.gemini.apiKey;
}

/**
 * Get Gemini status for health checks
 */
export function getGeminiStatus(): {
  available: boolean;
  model: string;
  extractionModel: string;
} {
  return {
    available: isGeminiAvailable(),
    model: config.gemini.model || 'not configured',
    extractionModel: config.gemini.extractionModel || 'not configured',
  };
}
