import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

// Groq API configuration - optimized for voice
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Fastest model for voice

// Constants for voice optimization
const MAX_TOKENS = 80; // Reduced for faster responses (keep answers concise)
const TIMEOUT_MS = 8000; // 8 second timeout for voice

interface ChatMessage {
  role: string;
  content: string;
}

/**
 * POST /llm/chat/completions - Streaming OpenAI-compatible endpoint for Vapi
 * Streams response tokens for minimal latency in voice calls
 */
router.post('/chat/completions', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = 'llm-' + Date.now();

  // Set headers for SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  try {
    const { messages, temperature, stream = true } = req.body as {
      messages?: ChatMessage[];
      temperature?: number;
      stream?: boolean;
    };

    console.log(`\n🤖 [LLM] Request ${requestId} - ${stream ? 'STREAMING' : 'NON-STREAMING'}`);

    if (!messages?.length) {
      res.status(400).json({ error: 'messages required' });
      return;
    }

    if (!config.groq.apiKey) {
      res.status(500).json({ error: 'GROQ_API_KEY not configured' });
      return;
    }

    // Transform messages for Groq (Vapi uses 'bot', we need 'assistant')
    const groqMessages = messages.map(m => ({
      role: m.role === 'bot' ? 'assistant' : m.role,
      content: m.content
    }));

    console.log(`[LLM] Messages: ${groqMessages.length}, First: ${groqMessages[0]?.content?.slice(0, 50)}...`);

    // Call Groq with streaming enabled
    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: temperature ?? 0.7,
        max_tokens: MAX_TOKENS,
        stream: true // Always stream for voice
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('[LLM] Groq error:', groqResponse.status, errorData);
      res.status(500).json({ error: 'LLM service error' });
      return;
    }

    // Stream the response to Vapi
    const reader = groqResponse.body?.getReader();
    if (!reader) {
      res.status(500).json({ error: 'No response stream' });
      return;
    }

    // Send OpenAI-compatible streaming response
    res.write(`data: ${JSON.stringify({
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: GROQ_MODEL,
      choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }]
    })}\n\n`);

    let fullContent = '';
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              // Send final chunk
              res.write(`data: ${JSON.stringify({
                id: requestId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: GROQ_MODEL,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
              })}\n\n`);
              res.write('data: [DONE]\n\n');
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                // Stream to Vapi immediately
                res.write(`data: ${JSON.stringify({
                  id: requestId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: GROQ_MODEL,
                  choices: [{ index: 0, delta: { content }, finish_reason: null }]
                })}\n\n`);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const duration = Date.now() - startTime;
    console.log(`[LLM] ✅ Stream completed in ${duration}ms, ${fullContent.length} chars`);
    res.end();

  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[LLM] ❌ Error after ${duration}ms:`, err.message);

    // Send error as final chunk
    res.write(`data: ${JSON.stringify({
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: GROQ_MODEL,
      choices: [{ index: 0, delta: { content: 'I apologize, but I encountered an error.' }, finish_reason: 'stop' }]
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

/**
 * Non-streaming fallback endpoint for testing
 */
router.post('/chat/completions/sync', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const requestId = 'llm-' + Date.now();

  try {
    const { messages, temperature } = req.body as {
      messages?: ChatMessage[];
      temperature?: number;
    };

    if (!messages?.length) {
      res.status(400).json({ error: 'messages required' });
      return;
    }

    if (!config.groq.apiKey) {
      res.status(500).json({ error: 'GROQ_API_KEY not configured' });
      return;
    }

    const groqMessages = messages.map(m => ({
      role: m.role === 'bot' ? 'assistant' : m.role,
      content: m.content
    }));

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: temperature ?? 0.7,
        max_tokens: MAX_TOKENS,
        stream: false
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('[LLM] Groq error:', groqResponse.status, errorData);
      res.status(500).json({ error: 'LLM service error' });
      return;
    }

    const groqData = await groqResponse.json();
    const content = groqData.choices?.[0]?.message?.content || '';

    const duration = Date.now() - startTime;
    console.log(`[LLM] ✅ Sync response in ${duration}ms`);

    res.json({
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: GROQ_MODEL,
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop'
      }],
      usage: groqData.usage
    });

  } catch (err: any) {
    console.error('[LLM] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'groq',
    model: GROQ_MODEL,
    streaming: true,
    hasApiKey: !!config.groq.apiKey
  });
});

export default router;
