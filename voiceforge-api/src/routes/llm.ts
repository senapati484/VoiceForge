import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

// Groq API configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Fast, good for voice

// POST /llm/chat/completions - OpenAI-compatible proxy for Vapi custom-llm using Groq
router.post('/chat/completions', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = 'llm-' + Date.now();

  try {
    const { messages, temperature } = req.body as {
      messages?: Array<{ role: string; content: string }>;
      temperature?: number;
    };

    console.log('\n🤖 [LLM] ===========================================');
    console.log('[LLM] REQUEST RECEIVED - ID:', requestId);
    console.log('[LLM] Timestamp:', new Date().toISOString());
    console.log('[LLM] Using provider: Groq');
    console.log('[LLM] Model:', GROQ_MODEL);

    // Validate messages
    if (!messages?.length) {
      console.error('[LLM] ERROR: No messages provided');
      res.status(400).json({ error: 'messages required' });
      return;
    }

    // Validate Groq API key
    if (!config.groq.apiKey) {
      console.error('[LLM] ERROR: GROQ_API_KEY not configured');
      res.status(500).json({ error: 'LLM service not configured - add GROQ_API_KEY to .env' });
      return;
    }

    console.log('[LLM] Messages received:', messages.length);
    messages.forEach((m, i) => {
      const contentPreview = typeof m.content === 'string'
        ? m.content.slice(0, 100) + (m.content.length > 100 ? '...' : '')
        : 'INVALID CONTENT TYPE';
      console.log(`[LLM]   [${i}] ${m.role}: ${contentPreview}`);
    });

    console.log('[LLM] Calling Groq API...');

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages.map(m => ({
          role: m.role === 'bot' ? 'assistant' : m.role,
          content: m.content
        })),
        temperature: temperature ?? 0.6,
        max_tokens: 150
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => null);
      console.error('[LLM] Groq API error:', groqResponse.status, errorData);
      throw new Error(`Groq API error: ${groqResponse.status} ${errorData?.error?.message || groqResponse.statusText}`);
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content || '';

    console.log('[LLM] Groq response received');
    console.log('[LLM] Response length:', content.length);
    console.log('[LLM] Response content:', content);

    if (!content || content.trim().length === 0) {
      console.error('[LLM] WARNING: Empty response from Groq!');
    }

    const duration = Date.now() - startTime;
    console.log(`[LLM] Request completed in ${duration}ms`);
    console.log('[LLM] ===========================================\n');

    // Return OpenAI-compatible format
    res.json({
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: GROQ_MODEL,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content || 'I apologize, but I am unable to respond at this moment.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: groqData.usage || {
        prompt_tokens: messages.reduce((acc, m) => acc + (m.content?.length || 0), 0),
        completion_tokens: content?.length || 0,
        total_tokens: messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) + (content?.length || 0)
      }
    });

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error('\n🤖 [LLM] ===========================================');
    console.error('[LLM] FATAL ERROR - Request ID:', requestId);
    console.error('[LLM] Error after', duration, 'ms');
    console.error('[LLM] Error:', err?.message);
    console.error('[LLM] ===========================================\n');

    // Return fallback
    res.status(200).json({
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: GROQ_MODEL,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'I apologize, but I encountered an error. Please try again.'
          },
          finish_reason: 'stop'
        }
      ],
      error: { message: err?.message }
    });
  }
});

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'groq',
    model: GROQ_MODEL,
    hasApiKey: !!config.groq.apiKey
  });
});

export default router;
