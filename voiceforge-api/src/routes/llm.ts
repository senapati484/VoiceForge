import { Router, Request, Response } from 'express';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { config } from '../config';

const router = Router();

const gemini = new ChatGoogleGenerativeAI({
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  temperature: 0.6
});

// POST /llm/chat/completions - OpenAI-compatible proxy for Vapi custom-llm
router.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    const { messages, temperature } = req.body as {
      messages?: Array<{ role: string; content: string }>;
      temperature?: number;
    };

    if (!messages?.length) {
      res.status(400).json({ error: 'messages required' });
      return;
    }

    const lcMessages = messages.map((m) => {
      const content = typeof m.content === 'string' ? m.content : '';
      if (m.role === 'system') return new SystemMessage(content);
      if (m.role === 'assistant') return new AIMessage(content);
      return new HumanMessage(content);
    });

    const temp = temperature !== undefined ? Math.min(2, Math.max(0, temperature)) : 0.6;
    const llm = temp === 0.6
      ? gemini
      : new ChatGoogleGenerativeAI({
          apiKey: config.gemini.apiKey,
          model: config.gemini.model,
          temperature: temp
        });

    const response = await llm.invoke(lcMessages);
    const content = typeof response.content === 'string' ? response.content : String(response.content);

    res.json({
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: config.gemini.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop'
        }
      ]
    });
  } catch (err) {
    console.error('[LLM Proxy] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'LLM proxy failed'
    });
  }
});

export default router;
