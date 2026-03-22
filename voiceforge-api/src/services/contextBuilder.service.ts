import { config } from '../config';
import { Agent, type IAgent } from '../db';

// In-memory cache for compiled contexts
const contextCache = new Map<string, { context: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

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
 */
export function buildCombinedSystemPrompt(
  agent: IAgent,
  businessContext?: KnowledgeFile | null
): string {
  const cacheKey = `combined-${agent._id}-${businessContext ? 'bc' : 'nbc'}`;

  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  const agentKnowledge = agent.knowledgeFile as KnowledgeFile | undefined;

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
  if (businessContext?.businessSummary) {
    parts.push(`\nCompany: ${businessContext.businessSummary.slice(0, 150)}`);
  }

  // Combined products/services
  const allProducts = [
    ...(agentKnowledge?.keyProducts?.slice(0, 2) || []),
    ...(businessContext?.keyProducts?.slice(0, 2) || [])
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
    ...(businessContext?.commonQA?.slice(0, 2) || [])
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
    ...(businessContext?.escalationTriggers || [])
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
