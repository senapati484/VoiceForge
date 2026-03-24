/**
 * Compact Context Service
 * Compresses verbose KnowledgeFile to token-efficient format
 * Expands compact format back to readable prompt
 */

import type { KnowledgeFile, CompactContextV2 } from '../types/compactContext';
import { COMPACT_LIMITS } from '../types/compactContext';
import type { IAgent } from '../db/models/Agent';

/**
 * Truncate string to max length, adding ellipsis if truncated
 */
function truncate(str: string | undefined | null, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Compress verbose KnowledgeFile to compact format
 * Reduces token count by ~60-70%
 *
 * @param kf - Verbose KnowledgeFile from extraction
 * @param agent - Agent config for tone and response rules
 * @returns CompactContextV2
 */
export function compressKnowledgeFile(
  kf: KnowledgeFile,
  agent?: { tone?: string; callObjective?: string }
): CompactContextV2 {
  // Compress products: "name|price|desc"
  const compressedProducts = kf.keyProducts
    ?.slice(0, COMPACT_LIMITS.products)
    .map(p => {
      const name = truncate(p.name, 20);
      const price = p.price ? truncate(p.price, 15) : '-';
      const desc = truncate(p.description, 25);
      return `${name}|${price}|${desc}`;
    }) || [];

  // Compress facts
  const compressedFacts = kf.importantFacts
    ?.slice(0, COMPACT_LIMITS.facts)
    .map(f => truncate(f, COMPACT_LIMITS.fact)) || [];

  // Compress Q&A: "question|answer"
  const compressedQA = kf.commonQA
    ?.slice(0, COMPACT_LIMITS.qa)
    .map(qa => {
      const q = truncate(qa.question, 35);
      const a = truncate(qa.answer, COMPACT_LIMITS.qaItem - 35);
      return `${q}|${a}`;
    }) || [];

  // Escalation triggers
  const escalations = kf.escalationTriggers?.slice(0, COMPACT_LIMITS.escalations) || [
    'Customer requests human agent',
    'Question outside scope',
    'Complaint or escalation'
  ];

  // Build compact context
  const compact: CompactContextV2 = {
    v: 2,
    a: truncate(kf.businessSummary, COMPACT_LIMITS.summary),
    p: compressedProducts,
    f: compressedFacts,
    q: compressedQA,
    e: escalations,
    t: agent?.tone || 'professional',
    r: '1-2 sentences'
  };

  // Log compression stats
  const originalSize = JSON.stringify(kf).length;
  const compactSize = JSON.stringify(compact).length;
  const savings = ((originalSize - compactSize) / originalSize * 100).toFixed(1);

  console.log(`[CompactContext] Compression: ${originalSize} → ${compactSize} chars (${savings}% savings)`);
  console.log(`[CompactContext] Fields: ${compact.p.length} products, ${compact.f.length} facts, ${compact.q.length} Q&A`);

  return compact;
}

/**
 * Expand compact context to human-readable system prompt
 * For use in voice LLM calls
 *
 * @param compact - CompactContextV2
 * @param agent - Agent details for identity
 * @returns Formatted system prompt string
 */
export function expandCompactContext(
  compact: CompactContextV2,
  agent: {
    name: string;
    agentType: string;
    businessName: string;
    callObjective: string;
  }
): string {
  const parts: string[] = [];

  // Identity
  parts.push(`You are ${agent.name}, ${compact.t} ${agent.agentType} agent for ${agent.businessName}.`);
  parts.push(`Goal: ${agent.callObjective}`);

  // Business context
  if (compact.a) {
    parts.push(`\nAbout: ${compact.a}`);
  }

  // Products
  if (compact.p?.length) {
    parts.push('\nProducts:');
    compact.p.forEach(productStr => {
      const [name, price, desc] = productStr.split('|');
      if (name) {
        const priceStr = price && price !== '-' ? ` (${price})` : '';
        parts.push(`- ${name}${priceStr}: ${desc || 'No description'}`);
      }
    });
  }

  // Facts
  if (compact.f?.length) {
    parts.push('\nKey Facts:');
    compact.f.forEach(fact => {
      parts.push(`• ${fact}`);
    });
  }

  // Q&A
  if (compact.q?.length) {
    parts.push('\nCommon Questions:');
    compact.q.forEach(qaStr => {
      const [question, answer] = qaStr.split('|');
      if (question && answer) {
        parts.push(`Q: ${question}`);
        parts.push(`A: ${answer}`);
      }
    });
  }

  // Escalation
  if (compact.e?.length) {
    parts.push(`\nEscalate when: ${compact.e.join(', ')}`);
  }

  // Rules
  parts.push(`\nRules: Keep answers ${compact.r}. Tone: ${compact.t}.`);
  parts.push(`If unsure: "I don't have that information, but I can connect you with our team."`);

  const prompt = parts.join('\n');

  console.log(`[CompactContext] Expanded to ${prompt.length} chars`);
  return prompt;
}

/**
 * Calculate token estimate for a string
 * Rough approximation: 1 token ≈ 4 chars for English
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Compare verbose vs compact format
 * Returns stats about token savings
 */
export function compareFormats(
  kf: KnowledgeFile,
  agent?: { tone?: string; callObjective?: string }
): {
  verboseTokens: number;
  compactTokens: number;
  expandedTokens: number;
  savings: number;
} {
  // Estimate verbose tokens
  const verboseStr = JSON.stringify(kf);
  const verboseTokens = estimateTokens(verboseStr);

  // Compress
  const compact = compressKnowledgeFile(kf, agent);
  const compactStr = JSON.stringify(compact);
  const compactTokens = estimateTokens(compactStr);

  // Expand
  const dummyAgent = {
    name: 'Agent',
    agentType: 'support',
    businessName: 'Company',
    callObjective: 'Help customers'
  };
  const expanded = expandCompactContext(compact, dummyAgent);
  const expandedTokens = estimateTokens(expanded);

  return {
    verboseTokens,
    compactTokens,
    expandedTokens,
    savings: Math.round((1 - expandedTokens / verboseTokens) * 100)
  };
}
