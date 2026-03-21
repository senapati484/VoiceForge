import type { Request, Response } from 'express';
import { config } from '../../config';
import { Agent, CallLog, User, CreditLedger, Campaign, CsvContact } from '../../db';
import { buildSystemPrompt } from '../../services/contextBuilder.service';
import { retrieveText } from '../../services/pinecone.service';

/**
 * Vapi Webhook Handler
 * Handles all Vapi server-to-server webhook events
 * Docs: https://docs.vapi.ai/server-url/events
 *
 * Events handled:
 * - assistant-request: Return assistant config for incoming calls
 * - tool-calls: Execute functions and return results
 * - status-update: Track call status changes
 * - end-of-call-report: Final call summary, deduct credits
 * - conversation-update: Real-time conversation updates (optional)
 */

export async function vapiWebhookHandler(req: Request, res: Response): Promise<void> {
  // Log raw request for debugging
  console.log('[Vapi Webhook] Received request:', {
    headers: req.headers,
    body: req.body
  });

  try {
    // Step 1: Verify webhook secret
    const secret = req.headers['x-vapi-secret'] as string;
    if (!secret || secret !== config.vapi.webhookSecret) {
      console.error('[Vapi Webhook] Unauthorized - invalid secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Step 2: Parse body based on how it was received
    let body: any;
    if (Buffer.isBuffer(req.body)) {
      body = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }

    console.log('[Vapi Webhook] Parsed body:', JSON.stringify(body, null, 2));

    // Step 3: Extract message type (Vapi 2024 format: body.message.type)
    const message = body.message || body;
    const messageType = message.type || body.type;

    if (!messageType) {
      console.error('[Vapi Webhook] No message type found');
      res.status(400).json({ error: 'No message type' });
      return;
    }

    console.log(`[Vapi Webhook] Processing event type: ${messageType}`);

    // Step 4: Route to appropriate handler
    switch (messageType) {
      case 'assistant-request':
        await handleAssistantRequest(message, res);
        break;

      case 'tool-calls':
        await handleToolCalls(message, res);
        break;

      case 'status-update':
        await handleStatusUpdate(message, res);
        break;

      case 'end-of-call-report':
        await handleEndOfCallReport(message, res);
        break;

      case 'conversation-update':
        // Optional: Handle real-time conversation updates
        console.log('[Vapi Webhook] Conversation update received');
        res.json({ received: true });
        break;

      case 'function-call':
        // Legacy or custom function call format
        await handleFunctionCall(message, res);
        break;

      default:
        console.log(`[Vapi Webhook] Unhandled event type: ${messageType}`);
        res.json({ received: true });
    }
  } catch (err) {
    console.error('[Vapi Webhook] Error:', err);
    res.status(200).json({ error: 'Internal error but acknowledged' });
  }
}

/**
 * Handle assistant-request
 * Sent when an incoming call is received and Vapi needs assistant configuration
 * Must respond within 7.5 seconds
 */
async function handleAssistantRequest(message: any, res: Response): Promise<void> {
  try {
    const { phoneNumber, call, customer } = message;
    console.log('[Vapi Webhook] Assistant request:', { phoneNumber, call });

    // Option 1: Return existing assistant ID
    // You can look up the assistant based on the phone number
    if (phoneNumber?.assistantId) {
      res.json({
        assistantId: phoneNumber.assistantId
      });
      return;
    }

    // Option 2: Return a transient assistant config
    // This creates an assistant on-the-fly for this call only
    res.json({
      assistant: {
        name: 'VoiceForge Assistant',
        firstMessage: 'Hello! Thanks for calling. How can I help you today?',
        voice: {
          provider: 'vapi',
          voiceId: 'elliot'
        },
        transcriber: {
          provider: 'vapi',
          language: 'en-US'
        },
        model: {
          provider: 'custom-llm',
          url: `${config.apiPublicUrl}/api/llm/chat/completions`,
          model: config.gemini.model,
          systemPrompt: 'You are a helpful voice assistant. Keep responses concise and natural for voice conversation.',
          temperature: 0.6
        },
        serverUrl: `${config.apiPublicUrl}/vapi/webhook`,
        endCallPhrases: ['goodbye', 'bye', 'hang up', 'end call'],
        maxDurationSeconds: 600
      }
    });
  } catch (err) {
    console.error('[Vapi Webhook] Assistant request error:', err);
    res.json({ error: 'Failed to load assistant' });
  }
}

/**
 * Handle tool-calls
 * Sent when AI triggers a function/tool
 * Must return results within timeout (default 20s)
 */
async function handleToolCalls(message: any, res: Response): Promise<void> {
  try {
    const { toolCallList, call } = message;
    console.log('[Vapi Webhook] Tool calls:', JSON.stringify(toolCallList, null, 2));

    if (!toolCallList || !Array.isArray(toolCallList)) {
      res.json({ results: [] });
      return;
    }

    // Process each tool call
    const results = await Promise.all(
      toolCallList.map(async (toolCall: any) => {
        const { id, name, parameters } = toolCall;

        try {
          // Execute the tool based on name
          const result = await executeTool(name, parameters, call);
          return {
            toolCallId: id,
            result: JSON.stringify(result).replace(/\n/g, ' ') // Single line only
          };
        } catch (err: any) {
          console.error(`[Vapi Webhook] Tool execution error for ${name}:`, err);
          return {
            toolCallId: id,
            error: err.message || 'Tool execution failed'
          };
        }
      })
    );

    console.log('[Vapi Webhook] Tool results:', JSON.stringify(results, null, 2));
    res.json({ results });
  } catch (err) {
    console.error('[Vapi Webhook] Tool calls error:', err);
    res.json({
      results: message.toolCallList?.map((t: any) => ({
        toolCallId: t.id,
        error: 'Internal error'
      })) || []
    });
  }
}

/**
 * Execute a tool by name
 * Add your custom tools here
 */
async function executeTool(name: string, parameters: any, call: any): Promise<any> {
  console.log(`[Vapi Webhook] Executing tool: ${name}`, parameters);

  switch (name) {
    case 'getCurrentTime':
      return {
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

    case 'lookupCustomer':
      // Example: Look up customer by phone number
      // You can integrate with your database here
      return {
        found: true,
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
          accountStatus: 'active'
        }
      };

    case 'bookAppointment':
      // Example: Book an appointment
      const { date, time, service } = parameters || {};
      return {
        success: true,
        appointmentId: `appt_${Date.now()}`,
        confirmedDate: date,
        confirmedTime: time,
        service: service
      };

    case 'sendSMS':
      // Example: Send SMS
      const { phoneNumber, message } = parameters || {};
      // Integrate with your SMS provider (Twilio, etc.)
      return {
        sent: true,
        to: phoneNumber,
        messageId: `msg_${Date.now()}`
      };

    case 'getKnowledge':
      // RAG - Retrieve knowledge from Pinecone
      const { query, userId, agentId } = parameters || {};
      if (userId && agentId && query) {
        const agent = await Agent.findById(agentId);
        if (agent) {
          const chunks = await retrieveText(userId, query, 3);
          return {
            context: buildSystemPrompt(agent, chunks)
          };
        }
      }
      return { context: 'No additional context available' };

    default:
      return {
        error: `Unknown tool: ${name}`
      };
  }
}

/**
 * Handle status-update
 * Sent when call status changes (initiated, in-progress, completed, etc.)
 */
async function handleStatusUpdate(message: any, res: Response): Promise<void> {
  try {
    const { call, status } = message;
    const vapiCallId = call?.id;

    console.log(`[Vapi Webhook] Status update: ${status} for call ${vapiCallId}`);

    if (vapiCallId) {
      const mappedStatus = mapVapiStatus(status);
      await CallLog.findOneAndUpdate(
        { vapiCallId },
        { status: mappedStatus },
        { new: true }
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Vapi Webhook] Status update error:', err);
    res.json({ received: true });
  }
}

/**
 * Handle end-of-call-report
 * Sent at the end of a call with full details
 * Used for billing, analytics, etc.
 */
async function handleEndOfCallReport(message: any, res: Response): Promise<void> {
  try {
    const { call, transcript, recordingUrl, summary } = message;
    const vapiCallId = call?.id;

    console.log(`[Vapi Webhook] End of call report for ${vapiCallId}`);

    if (!vapiCallId) {
      res.json({ received: true });
      return;
    }

    const startedAt = new Date(call?.startedAt);
    const endedAt = new Date(call?.endedAt);
    const durationSec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
    const credits = Math.ceil(durationSec / 60) * 3; // 3 credits per minute

    // Update call log
    const log = await CallLog.findOneAndUpdate(
      { vapiCallId },
      {
        status: 'completed',
        transcript: transcript || [],
        durationSec,
        creditsUsed: credits,
        endedAt,
        startedAt,
        recordingUrl,
        summary
      },
      { new: true }
    );

    if (log) {
      // Deduct credits
      await User.findByIdAndUpdate(log.userId, { $inc: { credits: -credits } });

      // Record in ledger
      await CreditLedger.create({
        userId: log.userId,
        type: 'deduct',
        amount: -credits,
        description: `Call ${durationSec}s`,
        callLogId: log._id
      });

      // Update campaign stats if applicable
      if (log.csvContactId && log.campaignId) {
        const isAnswered = transcript && transcript.length > 1;

        await CsvContact.findByIdAndUpdate(log.csvContactId, {
          status: isAnswered ? 'answered' : 'no-answer',
          callLogId: log._id,
          calledAt: new Date()
        });

        await Campaign.findByIdAndUpdate(log.campaignId, {
          $inc: {
            called: 1,
            ...(isAnswered ? { answered: 1 } : { noAnswer: 1 })
          }
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Vapi Webhook] End of call report error:', err);
    res.json({ received: true });
  }
}

/**
 * Handle legacy function-call format
 * Some Vapi versions may still use this format
 */
async function handleFunctionCall(message: any, res: Response): Promise<void> {
  try {
    const { functionCall, call } = message;
    const { query, userId, agentId } = functionCall?.parameters || {};

    console.log('[Vapi Webhook] Legacy function call:', functionCall);

    if (!userId || !agentId || !query) {
      res.json({ result: 'Missing parameters' });
      return;
    }

    const agent = await Agent.findById(agentId);
    if (!agent) {
      res.json({ result: 'Agent not found' });
      return;
    }

    const chunks = await retrieveText(userId, query, 3);
    const systemPrompt = buildSystemPrompt(agent, chunks);

    res.json({ result: systemPrompt });
  } catch (err) {
    console.error('[Vapi Webhook] Function call error:', err);
    res.json({ result: 'Error retrieving context' });
  }
}

function mapVapiStatus(vapiStatus: string): string {
  const statusMap: Record<string, string> = {
    initiated: 'initiated',
    'in-progress': 'in-progress',
    ongoing: 'in-progress',
    completed: 'completed',
    ended: 'completed',
    failed: 'failed'
  };
  return statusMap[vapiStatus] || vapiStatus;
}
