/**
 * Compact Context Format v2
 * Token-optimized representation of knowledge for AI consumption
 *
 * Benefits:
 * - 60-70% smaller than verbose KnowledgeFile format
 * - Dense information without human-readable fluff
 * - Easy for LLMs to parse (structured JSON)
 *
 * Usage:
 * 1. Extract with Gemini/Groq -> KnowledgeFile (verbose)
 * 2. Compress with compressKnowledgeFile() -> CompactContextV2
 * 3. Store in DB
 * 4. Expand with expandCompactContext() -> System prompt for voice
 */

/**
 * Legacy KnowledgeFile (verbose format)
 * Keep for backward compatibility during migration
 */
export interface KnowledgeFile {
  businessSummary: string;
  keyProducts: Array<{
    name: string;
    price?: string;
    description: string;
    features: string[];
  }>;
  commonQA: Array<{ question: string; answer: string }>;
  importantFacts: string[];
  escalationTriggers: string[];
}

/**
 * Compact Context Format v2
 * Designed for minimal token usage while preserving semantic meaning
 */
export interface CompactContextV2 {
  v: 2;                          // Version identifier
  a: string;                     // Agent/business summary (max 100 chars)
  p: string[];                   // Products: "name|price|desc" (max 50 chars each)
  f: string[];                   // Facts (max 40 chars each)
  q: string[];                   // Q&A: "question|answer" (max 80 chars each)
  e: string[];                   // Escalation triggers
  t: string;                     // Tone of voice
  r: string;                     // Response rules
}

/**
 * Union type for transition period
 * Supports both legacy and compact formats
 */
export type KnowledgeContext = KnowledgeFile | CompactContextV2;

/**
 * Type guard for CompactContextV2
 * Usage: if (isCompactContext(ctx)) { ... }
 */
export function isCompactContext(ctx: KnowledgeContext): ctx is CompactContextV2 {
  return ctx && typeof ctx === 'object' && 'v' in ctx && ctx.v === 2;
}

/**
 * Type guard for KnowledgeFile (legacy)
 * Usage: if (isKnowledgeFile(ctx)) { ... }
 */
export function isKnowledgeFile(ctx: KnowledgeContext): ctx is KnowledgeFile {
  return ctx && typeof ctx === 'object' && 'businessSummary' in ctx && !('v' in ctx);
}

/**
 * Maximum lengths for compact fields
 * Used to enforce size limits during compression
 */
export const COMPACT_LIMITS = {
  summary: 100,      // a: businessSummary
  productItem: 50,   // p: "name|price|desc"
  fact: 40,          // f: individual facts
  qaItem: 80,        // q: "question|answer"
  products: 5,       // max products to keep
  facts: 8,          // max facts to keep
  qa: 5,             // max Q&A pairs to keep
  escalations: 5,    // max escalation triggers
} as const;
