import { config } from '../config';
import { Agent, type IAgent, UserKnowledgeContext } from '../db';
import { buildSystemPrompt, buildCombinedSystemPrompt, type KnowledgeFile } from './contextBuilder.service';

const VAPI = 'https://api.vapi.ai';

const hdrs = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${config.vapi.apiKey}`
});

async function vapiRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  if (!config.vapi.apiKey) {
    throw new Error('Vapi API key missing. Set VAPI_API_KEY to your Vapi private/server key.');
  }
  const response = await fetch(`${VAPI}${endpoint}`, {
    ...options,
    headers: {
      ...hdrs(),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    const keyHint =
      response.status === 401
        ? ' Vapi returned 401 Unauthorized. Ensure VAPI_API_KEY is a Vapi private/server key (not public/client key).'
        : '';
    throw new Error(`Vapi API error: ${response.status} ${error}${keyHint}`);
  }

  return response.json();
}

function getOpeningLine(agent: IAgent): string {
  const lines: Record<string, string> = {
    marketing: `Hi! I'm ${agent.name} calling from ${agent.businessName}. Is this a good time?`,
    support: `Thank you for calling ${agent.businessName}. I'm ${agent.name}, how can I help?`,
    sales: `Hi, I'm ${agent.name} from ${agent.businessName}. I'm reaching out about our services — do you have a moment?`,
    tech: `${agent.businessName} tech support, this is ${agent.name}. How can I assist you today?`
  };
  return lines[agent.agentType] || lines.marketing;
}

export async function createVapiAssistant(agent: IAgent): Promise<string> {
  const systemPrompt = buildSystemPrompt(agent, []);
  const requestBody = {
    name: agent.name,
    // Voice config - vapi voices don't support fallback
    voice: {
      provider: 'vapi',
      voiceId: agent.voiceId
    },
    // Transcriber - use deepgram (vapi is not a valid provider)
    transcriber: {
      provider: 'deepgram',
      model: 'nova-2',
      language: agent.language || 'en'
    },
    model: {
      provider: 'custom-llm',
      url: `${config.apiPublicUrl}/api/llm/chat/completions`,
      model: config.gemini.model,
      systemPrompt: systemPrompt,
      temperature: 0.6
    },
    // Server URL for webhooks - uses the new /vapi/webhook endpoint
    serverUrl: `${config.apiPublicUrl}/vapi/webhook`,
    serverUrlSecret: config.vapi.webhookSecret,
    firstMessage: getOpeningLine(agent),
    endCallPhrases: ['goodbye', 'bye', 'hang up', 'end call'],
    maxDurationSeconds: 600
  };

  console.log('[Vapi] Creating assistant with config:', JSON.stringify(requestBody, null, 2));

  const assistant = await vapiRequest('/assistant', {
    method: 'POST',
    body: JSON.stringify(requestBody)
  }) as { id: string };

  console.log('[Vapi] Assistant created successfully:', assistant.id);
  return assistant.id;
}

export async function updateVapiAssistant(vapiId: string, updates: Partial<IAgent>): Promise<void> {
  const body: Record<string, unknown> = {};

  if (updates.name) body.name = updates.name;
  if (updates.voiceId) {
    body.voice = {
      provider: 'vapi',
      voiceId: updates.voiceId
    };
  }
  if (updates.language) {
    body.transcriber = {
      provider: 'deepgram',
      model: 'nova-2',
      language: updates.language || 'en'
    };
  }

  await vapiRequest(`/assistant/${vapiId}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export async function deleteVapiAssistant(vapiId: string): Promise<void> {
  try {
    await vapiRequest(`/assistant/${vapiId}`, {
      method: 'DELETE'
    });
  } catch (err) {
    // Ignore 404 errors (assistant already deleted)
    if (err instanceof Error && err.message.includes('404')) {
      return;
    }
    throw err;
  }
}

export async function triggerOutboundCall(
  vapiAssistantId: string,
  toNumber: string,
  metadata?: Record<string, string>,
  phoneNumberId?: string
): Promise<{ id: string }> {
  const body: any = {
    assistantId: vapiAssistantId,
    customer: { number: toNumber },
    // Pass metadata at top level (not inside assistantOverrides)
    metadata: metadata || undefined
  };

  // Only add phoneNumberId if provided (for domestic calls with paid numbers)
  // For international calls or free-tier numbers, omit this to use Vapi platform number
  if (phoneNumberId) {
    body.phoneNumberId = phoneNumberId;
  }

  console.log('[Vapi] Making outbound call:', {
    to: toNumber,
    assistantId: vapiAssistantId,
    usingNumber: phoneNumberId || 'Vapi platform number (international mode)'
  });

  const response = await vapiRequest('/call/phone', {
    method: 'POST',
    body: JSON.stringify(body)
  }) as { id: string };

  console.log('[Vapi] Call initiated:', response.id);
  return response;
}

/**
 * Trigger outbound call with DYNAMIC context (forces webhook usage)
 * This passes full assistant configuration instead of just assistantId
 * Forces Vapi to call our webhook for fresh context on every call
 */
export async function triggerOutboundCallWithDynamicContext(
  agent: IAgent,
  toNumber: string,
  metadata?: Record<string, string>,
  phoneNumberId?: string
): Promise<{ id: string }> {
  // Load user's business context
  const userContext = await UserKnowledgeContext.findOne({ userId: agent.userId });

  // Build combined system prompt with agent + business context
  const knowledgeFile = userContext?.knowledgeFile
    ? (userContext.knowledgeFile as unknown as KnowledgeFile)
    : undefined;
  const systemPrompt = buildCombinedSystemPrompt(agent, knowledgeFile);

  // Build first message based on agent and contact info
  const contactName = metadata?.contactName;
  const firstMessage = contactName
    ? `Hi! I'm ${agent.name} calling from ${agent.businessName}. Is this ${contactName}?`
    : getOpeningLine(agent);

  // Call Vapi with FULL assistant config (no assistantId - this forces webhook)
  const body: any = {
    assistant: {
      name: agent.name,
      firstMessage: firstMessage,
      voice: {
        provider: 'vapi',
        voiceId: agent.voiceId || 'Elliot'
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: agent.language || 'en'
      },
      model: {
        provider: 'custom-llm',
        url: `${config.apiPublicUrl}/api/llm/chat/completions`,
        model: config.gemini.model,
        systemPrompt: systemPrompt,
        temperature: 0.6
      },
      serverUrl: `${config.apiPublicUrl}/vapi/webhook`,
      endCallPhrases: ['goodbye', 'bye', 'hang up', 'end call'],
      maxDurationSeconds: 600
    },
    customer: { number: toNumber },
    // Pass metadata at top level for tracking
    metadata: metadata || undefined
  };

  // Only add phoneNumberId for domestic calls (optional)
  if (phoneNumberId) {
    body.phoneNumberId = phoneNumberId;
  }

  console.log('[Vapi] Making call with DYNAMIC context:', {
    to: toNumber,
    agentName: agent.name,
    businessName: agent.businessName,
    systemPromptLength: systemPrompt.length,
    hasBusinessContext: !!userContext?.knowledgeFile
  });

  return vapiRequest('/call/phone', {
    method: 'POST',
    body: JSON.stringify(body)
  }) as Promise<{ id: string }>;
}

export async function purchasePhoneNumber(areaCode?: string): Promise<{ id: string; number: string }> {
  const response = await vapiRequest('/phone-number', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'vapi',
      areaCode
    })
  }) as { id: string; number: string };

  return response;
}

export async function assignPhoneToAssistant(phoneNumberId: string, assistantId: string): Promise<void> {
  await vapiRequest(`/phone-number/${phoneNumberId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      assistantId
    })
  });
}

export async function listAvailableVoices(): Promise<Array<{ id: string; name: string; gender: string }>> {
  return [
    { id: 'joseph', name: 'Joseph', gender: 'male' },
    { id: 'jennifer', name: 'Jennifer', gender: 'female' },
    { id: 'michael', name: 'Michael', gender: 'male' },
    { id: 'sarah', name: 'Sarah', gender: 'female' },
    { id: 'alex', name: 'Alex', gender: 'male' },
    { id: 'emma', name: 'Emma', gender: 'female' }
  ];
}
