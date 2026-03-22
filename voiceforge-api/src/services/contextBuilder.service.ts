import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { config } from '../config';
import { KnowledgeDoc, Agent, type IAgent } from '../db';
import { getPresignedUrl } from './r2.service';

function getGeminiClient(): ChatGoogleGenerativeAI {
  if (!config.gemini.apiKey) {
    throw new Error('Gemini API key missing');
  }
  return new ChatGoogleGenerativeAI({
    apiKey: config.gemini.apiKey,
    model: config.gemini.model,
    temperature: 0,
      
  });
}

export interface KnowledgeFile {
  businessSummary: string;
  keyProducts: Array<{
    name: string;
    price?: string;
    description: string;
    features: string[];
  }>;
  commonQA: Array<{
    question: string;
    answer: string;
  }>;
  importantFacts: string[];
  escalationTriggers: string[];
}

function emptyKnowledgeFile(): KnowledgeFile {
  return {
    businessSummary: '',
    keyProducts: [],
    commonQA: [],
    importantFacts: [],
    escalationTriggers: []
  };
}

function normalizeKnowledgeFile(parsed: Partial<KnowledgeFile>): KnowledgeFile {
  return {
    businessSummary: parsed.businessSummary || '',
    keyProducts: parsed.keyProducts || [],
    commonQA: parsed.commonQA || [],
    importantFacts: parsed.importantFacts || [],
    escalationTriggers: parsed.escalationTriggers || []
  };
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const start = trimmed.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found in model response');
  }
  let depth = 0;
  for (let i = start; i < trimmed.length; i += 1) {
    if (trimmed[i] === '{') depth += 1;
    if (trimmed[i] === '}') depth -= 1;
    if (depth === 0) return trimmed.slice(start, i + 1);
  }
  throw new Error('Unterminated JSON object in model response');
}

function buildContextPrompt(docsText: string): { system: string; user: string } {
  return {
    system:
      'You extract business knowledge from documents to create a compact reference file for an AI phone calling agent. Extract only what is actionable during a real phone call. Be specific with prices, hours, contacts, and procedures. Return only valid JSON, no explanation.',
    user: `Documents:
${docsText}

Return this exact JSON structure:
{
  "businessSummary": "2-3 sentences what the business does",
  "keyProducts": [{ "name": "", "price": "", "description": "", "features": [] }],
  "commonQA": [{ "question": "", "answer": "" }],
  "importantFacts": ["hours: Mon-Sat 9am-7pm", "location: ...", "contact: ..."],
  "escalationTriggers": ["asks to speak to manager", "complaint about billing", "legal issues"]
}`
  };
}

function buildAgentContextPrompt(input: {
  agentType: string;
  description: string;
  callObjective: string;
  userContext?: KnowledgeFile;
}): { system: string; user: string } {
  const contextJson = input.userContext ? JSON.stringify(input.userContext, null, 2).slice(0, 8000) : '';
  return {
    system:
      'You create a compact calling context JSON for a phone AI agent. Return only valid JSON with no markdown.',
    user: `Agent type: ${input.agentType}
Agent description:
${input.description}

Call objective:
${input.callObjective}

${contextJson ? `User-level business context (optional):\n${contextJson}\n` : ''}
Return this exact JSON structure:
{
  "businessSummary": "2-3 concise sentences focused on this agent's role",
  "keyProducts": [{ "name": "", "price": "", "description": "", "features": [] }],
  "commonQA": [{ "question": "", "answer": "" }],
  "importantFacts": ["..."],
  "escalationTriggers": ["..."]
}`
  };
}

/**
 * Enhanced prompt builder that generates richer agent contexts with
 * detailed persona, talking points, objection handling, and call flow
 */
function buildEnhancedAgentContextPrompt(input: {
  agentType: string;
  description: string;
  callObjective: string;
  userContext?: KnowledgeFile;
}): { system: string; user: string } {
  const contextJson = input.userContext ? JSON.stringify(input.userContext, null, 2).slice(0, 6000) : '';

  const systemPrompt = `You are an expert AI agent designer specializing in voice calling agents.
Analyze the user's description and generate a comprehensive agent context.
The context should be detailed enough for an AI to conduct professional calls.

Key requirements:
1. Analyze the description deeply - extract implied products, services, and capabilities
2. Generate realistic Q&A based on the agent type and description
3. Include specific objection handling responses
4. Define clear escalation triggers
5. Reference the user's business context where relevant

Return ONLY valid JSON - no markdown, no explanation.`;

  const userPrompt = `AGENT TYPE: ${input.agentType}

AGENT DESCRIPTION:
${input.description}

CALL OBJECTIVE:
${input.callObjective}

${contextJson ? `BUSINESS CONTEXT (merge this information where relevant):
${contextJson}

` : ''}Generate a comprehensive agent context with this structure:

{
  "businessSummary": "Detailed 3-4 sentence summary of what this agent handles, including the business value proposition",
  "keyProducts": [
    {
      "name": "Product/Service name",
      "price": "Price range or tier if mentioned",
      "description": "Clear description of what it is and who needs it",
      "features": ["key feature 1", "key feature 2", "benefit to customer"]
    }
  ],
  "commonQA": [
    {
      "question": "Common question a caller might ask",
      "answer": "Professional, helpful answer (2-3 sentences max)"
    }
  ],
  "importantFacts": [
    "Operating hours or availability",
    "Typical response time or process",
    "Any guarantees or policies",
    "Contact method preferences"
  ],
  "escalationTriggers": [
    "When to transfer to human",
    "Complaint indicators",
    "Complex issue signals"
  ]
}

Important:
- Generate at least 5-8 common Q&A pairs based on the agent type and description
- Include realistic objections and responses
- If the business context mentions products/pricing, reference them
- Make the tone professional but conversational for phone calls`;

  return { system: systemPrompt, user: userPrompt };
}

async function generateWithGemini(docsText: string): Promise<KnowledgeFile> {
  const prompt = buildContextPrompt(docsText);
  const response = await getGeminiClient().invoke([
    new SystemMessage(prompt.system),
    new HumanMessage(prompt.user)
  ]);

  const content = typeof response.content === 'string' ? response.content : String(response.content);
  const parsed = JSON.parse(extractJsonObject(content)) as Partial<KnowledgeFile>;
  return normalizeKnowledgeFile(parsed);
}

async function generateWithHfModel(docsText: string): Promise<KnowledgeFile> {
  if (!config.hf.apiToken) {
    throw new Error('HF API token missing');
  }

  const prompt = buildContextPrompt(docsText);
  const inferenceUrl =
    config.hf.inferenceUrl ||
    `https://api-inference.huggingface.co/models/${encodeURIComponent(config.hf.modelId)}`;

  const response = await fetch(inferenceUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.hf.apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: `${prompt.system}\n\n${prompt.user}`,
      parameters: {
        max_new_tokens: 1000,
        return_full_text: false,
        temperature: 0.2
      },
      options: { wait_for_model: true }
    })
  });

  const payload = await response.json() as
    | Array<{ generated_text?: string }>
    | { generated_text?: string; error?: string };

  if (!response.ok) {
    const message =
      !Array.isArray(payload) && payload?.error
        ? payload.error
        : `HF inference request failed with ${response.status}`;
    throw new Error(message);
  }

  const content = Array.isArray(payload)
    ? (payload[0]?.generated_text || '')
    : (payload.generated_text || '');

  if (!content) {
    throw new Error('HF model returned empty text');
  }

  const parsed = JSON.parse(extractJsonObject(content)) as Partial<KnowledgeFile>;
  return normalizeKnowledgeFile(parsed);
}

export async function buildKnowledgeFile(
  userId: string
): Promise<KnowledgeFile> {
  // Step 1: Find all ready knowledge docs for this user
  const docs = await KnowledgeDoc.find({
    userId,
    status: { $in: ['ready', 'pending'] },
    r2Key: { $exists: true, $ne: '' }
  });

  // Step 2: Fetch full text from R2 for each doc
  const texts: string[] = [];
  for (const doc of docs) {
    // Skip CSV files (they are contacts, not knowledge)
    if (doc.type === 'csv') continue;

    try {
      const url = await getPresignedUrl(doc.r2Key);
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        texts.push(text);
      }
    } catch (err) {
      console.error(`Failed to fetch doc ${doc._id}:`, err);
    }
  }

  // Step 3: Combine and truncate
  const combined = texts.join('\n\n---NEW DOCUMENT---\n\n');
  const truncated = combined.slice(0, 30000); // Keep prompt size safe for hosted inference providers

  // If no documents, return empty structure
  if (!truncated) {
    return emptyKnowledgeFile();
  }

  // Step 4: Generate with selected provider.
  // If explicitly set to gemini, do not attempt HF.
  const providers =
    config.context.provider === 'gemini'
      ? (['gemini'] as const)
      : (['hf', 'gemini'] as const);

  for (const provider of providers) {
    try {
      if (provider === 'hf') {
        return await generateWithHfModel(truncated);
      }
      return await generateWithGemini(truncated);
    } catch (err) {
      console.error(`Context generation with ${provider} failed:`, err);
    }
  }

  console.error('Failed to build knowledge file: all providers failed');
  return emptyKnowledgeFile();
}

export async function buildAgentKnowledgeFile(input: {
  agentType: string;
  description: string;
  callObjective: string;
  userContext?: KnowledgeFile;
}): Promise<KnowledgeFile> {
  if (!input.description?.trim() || !input.callObjective?.trim()) {
    return emptyKnowledgeFile();
  }

  // Use enhanced prompt that generates richer context
  const prompt = buildEnhancedAgentContextPrompt(input);
  try {
    const response = await getGeminiClient().invoke([
      new SystemMessage(prompt.system),
      new HumanMessage(prompt.user)
    ]);
    const content = typeof response.content === 'string' ? response.content : String(response.content);
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<KnowledgeFile>;
    return normalizeKnowledgeFile(parsed);
  } catch (err) {
    console.error('Failed to build agent knowledge file:', err);
    return emptyKnowledgeFile();
  }
}

// Role guidelines by agent type
const roleGuidelines: Record<string, { do: string[]; dont: string[] }> = {
  marketing: {
    do: [
      'introduce yourself and the product clearly',
      'highlight key benefits',
      'handle objections politely',
      'collect callback number if interested',
      'confirm contact details at end of call'
    ],
    dont: [
      'make false claims',
      'pressure the caller',
      'discuss competitors negatively',
      'share pricing without explaining value first'
    ]
  },
  support: {
    do: [
      'acknowledge the issue empathetically',
      'gather account/order details',
      'provide step-by-step solutions',
      'confirm resolution before ending'
    ],
    dont: [
      'promise timelines you cannot guarantee',
      'blame the user',
      'say "I dont know" without offering to escalate'
    ]
  },
  sales: {
    do: [
      'qualify interest and budget early',
      'explain value proposition clearly',
      'handle objections with evidence',
      'suggest a concrete next step (demo/trial)'
    ],
    dont: [
      'pressure for immediate decision',
      'exaggerate features',
      'discuss pricing before understanding needs'
    ]
  },
  tech: {
    do: [
      'ask for exact error message and OS/version',
      'provide numbered steps',
      'confirm each step worked before next',
      'offer to follow up if not resolved'
    ],
    dont: [
      'assume technical level',
      'use jargon without explanation',
      'skip troubleshooting steps'
    ]
  }
};

export function buildPersonaPrompt(agent: IAgent): string {
  const guidelines = roleGuidelines[agent.agentType];
  if (!guidelines) return '';

  return `ROLE GUIDELINES:

DO:
${guidelines.do.map(g => `• ${g}`).join('\n')}

DON'T:
${guidelines.dont.map(g => `• ${g}`).join('\n')}`;
}

export function buildSystemPrompt(
  agent: IAgent,
  contextChunks: string[] = []
): string {
  const knowledgeStr = agent.knowledgeFile
    ? JSON.stringify(agent.knowledgeFile, null, 2).slice(0, 2000)
    : 'No knowledge base loaded.';

  const contextStr =
    contextChunks.length > 0
      ? `\n\nSPECIFIC CONTEXT FOR THIS QUERY:\n${contextChunks.join('\n---\n')}`
      : '';

  return `You are ${agent.name}, a ${agent.agentType} agent for ${agent.businessName}.

CALL OBJECTIVE: ${agent.callObjective}

${buildPersonaPrompt(agent)}

YOUR BUSINESS KNOWLEDGE:
${knowledgeStr}${contextStr}

RULES:
• Phone call — keep answers to 1-3 sentences maximum
• Tone: ${agent.tone}. Language: ${agent.language}
• If you don't know: "I don't have that information right now. I can connect you with our team for details."
• Never invent prices, policies, or facts not in your knowledge`;
}

/**
 * Build a compact system prompt optimized for Vapi webhook calls
 * Includes essential business context without exceeding size limits
 */
export function buildCompactSystemPrompt(agent: IAgent): string {
  // Extract key info from knowledge file if available
  let businessSummary = '';
  let keyProducts: string[] = [];
  let commonQA: string[] = [];
  let importantFacts: string[] = [];

  if (agent.knowledgeFile && typeof agent.knowledgeFile === 'object') {
    const kf = agent.knowledgeFile as KnowledgeFile;
    businessSummary = kf.businessSummary || '';

    if (kf.keyProducts?.length) {
      keyProducts = kf.keyProducts.slice(0, 5).map(p =>
        `• ${p.name}${p.price ? ` (${p.price})` : ''}: ${p.description}`
      );
    }

    if (kf.commonQA?.length) {
      commonQA = kf.commonQA.slice(0, 5).map(qa =>
        `Q: ${qa.question}\nA: ${qa.answer}`
      );
    }

    if (kf.importantFacts?.length) {
      importantFacts = kf.importantFacts.slice(0, 5);
    }
  }

  const guidelines = roleGuidelines[agent.agentType] || { do: [], dont: [] };

  return `You are ${agent.name}, a ${agent.agentType} agent for ${agent.businessName}.

CALL OBJECTIVE: ${agent.callObjective}

${businessSummary ? `BUSINESS SUMMARY:\n${businessSummary}\n` : ''}

ROLE GUIDELINES:
Do:
${guidelines.do.slice(0, 4).map(g => `• ${g}`).join('\n')}

Don't:
${guidelines.dont.slice(0, 3).map(g => `• ${g}`).join('\n')}

${keyProducts.length ? `PRODUCTS/SERVICES:\n${keyProducts.join('\n')}\n` : ''}

${commonQA.length ? `COMMON Q\&A:\n${commonQA.join('\n---\n')}\n` : ''}

${importantFacts.length ? `IMPORTANT FACTS:\n${importantFacts.map(f => `• ${f}`).join('\n')}` : ''}

RULES:
• Keep answers to 1-3 sentences for phone calls
• Tone: ${agent.tone}. Language: ${agent.language}
• If unsure: "I don't have that information. Let me connect you with our team."
• Never invent facts not provided above`;
}

/**
 * Build a combined system prompt with AGENT CONTEXT + BUSINESS CONTEXT
 * This provides comprehensive context for customer support calls
 */
export function buildCombinedSystemPrompt(
  agent: IAgent,
  businessContext?: KnowledgeFile | null
): string {
  // Extract agent's context from knowledgeFile
  let agentContext = agent.knowledgeFile as KnowledgeFile | undefined;

  // Build agent-specific section
  let agentSection = '';
  if (agentContext) {
    const ac = agentContext;
    const products = ac.keyProducts?.slice(0, 5).map(p =>
      `• ${p.name}${p.price ? ` (${p.price})` : ''}: ${p.description}`
    ).join('\n') || '';

    const qa = ac.commonQA?.slice(0, 6).map(qa =>
      `Q: ${qa.question}\nA: ${qa.answer}`
    ).join('\n---\n') || '';

    const facts = ac.importantFacts?.slice(0, 5).map(f => `• ${f}`).join('\n') || '';

    agentSection = `=== AGENT CONTEXT ===
${ac.businessSummary ? `Purpose: ${ac.businessSummary}\n` : ''}
${products ? `Agent Products/Services:\n${products}\n` : ''}
${qa ? `Agent Q\&A:\n${qa}\n` : ''}
${facts ? `Agent Facts:\n${facts}\n` : ''}
${ac.escalationTriggers?.length ? `Escalate if: ${ac.escalationTriggers.slice(0, 3).join(', ')}` : ''}`;
  }

  // Build business context section
  let businessSection = '';
  if (businessContext) {
    const bc = businessContext;
    const bcProducts = bc.keyProducts?.slice(0, 5).map(p =>
      `• ${p.name}${p.price ? ` (${p.price})` : ''}: ${p.description}`
    ).join('\n') || '';

    const bcQA = bc.commonQA?.slice(0, 5).map(qa =>
      `Q: ${qa.question}\nA: ${qa.answer}`
    ).join('\n---\n') || '';

    const bcFacts = bc.importantFacts?.slice(0, 6).map(f => `• ${f}`).join('\n') || '';

    businessSection = `=== BUSINESS CONTEXT ===
${bc.businessSummary ? `About: ${bc.businessSummary}\n` : ''}
${bcProducts ? `Company Offerings:\n${bcProducts}\n` : ''}
${bcQA ? `General Q\&A:\n${bcQA}\n` : ''}
${bcFacts ? `Company Facts:\n${bcFacts}\n` : ''}
${bc.escalationTriggers?.length ? `Company Escalations: ${bc.escalationTriggers.slice(0, 3).join(', ')}` : ''}`;
  }

  // Get role guidelines
  const guidelines = roleGuidelines[agent.agentType] || { do: [], dont: [] };

  // Combine everything
  return `You are ${agent.name}, a ${agent.agentType} agent for ${agent.businessName}.

CALL OBJECTIVE: ${agent.callObjective}

${agentSection}

${businessSection}

ROLE GUIDELINES:
Do:
${guidelines.do.slice(0, 4).map(g => `• ${g}`).join('\n')}

Don't:
${guidelines.dont.slice(0, 3).map(g => `• ${g}`).join('\n')}

INSTRUCTIONS:
• Phone conversation - keep responses to 1-3 sentences
• Tone: ${agent.tone}. Language: ${agent.language}
• Use agent context for specific tasks, business context for general knowledge
• If caller asks something outside both contexts: "I don't have that information, but I can connect you with our team."
• Never invent prices, policies, or facts not in your context`;
}
