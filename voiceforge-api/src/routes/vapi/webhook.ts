import type { Request, Response } from 'express';
import { config } from '../../config';
import { Agent, CallLog, User, CreditLedger, Campaign, CsvContact, UserKnowledgeContext } from '../../db';
import { buildSystemPrompt, buildPersonaPrompt, buildCompactSystemPrompt, buildCombinedSystemPrompt, type KnowledgeFile } from '../../services/contextBuilder.service';
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
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🎙️  [Vapi Webhook] === WEBHOOK CALLED ===');
  console.log('═══════════════════════════════════════════════════');
  console.log('[Vapi Webhook] Timestamp:', new Date().toISOString());
  console.log('[Vapi Webhook] Method:', req.method);
  console.log('[Vapi Webhook] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[Vapi Webhook] Raw Body:', req.body);

  try {
    // Step 1: Parse body based on how it was received
    let body: any;
    if (!req.body) {
      console.error('[Vapi Webhook] No body received');
      res.status(400).json({ error: 'No body' });
      return;
    }
    if (Buffer.isBuffer(req.body)) {
      body = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }

    console.log('[Vapi Webhook] Parsed body:', JSON.stringify(body, null, 2));

    // Step 2: Extract message type (Vapi 2024 format: body.message.type)
    const message = body.message || body;
    const messageType = message.type || body.type;

    if (!messageType) {
      console.error('[Vapi Webhook] No message type found');
      res.status(400).json({ error: 'No message type' });
      return;
    }

    // Step 3: Verify webhook secret (skip for assistant-request on incoming calls)
    const secret = req.headers['x-vapi-secret'] as string;
    // For assistant-request on incoming calls, Vapi may not send the secret
    // For other events and API calls, require the secret
    if (messageType !== 'assistant-request' && (!secret || secret !== config.vapi.webhookSecret)) {
      console.error('[Vapi Webhook] Unauthorized - invalid secret');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    console.log(`[Vapi Webhook] Processing event type: ${messageType}`);
    console.log('[Vapi Webhook] Message payload:', JSON.stringify(message, null, 2));

    // Step 4: Route to appropriate handler
    console.log('[Vapi Webhook] Routing to handler for:', messageType);
    switch (messageType) {
      case 'assistant-request':
        await handleAssistantRequest(message, res);
        break;

      case 'tool-calls':
        await handleToolCalls(message, res);
        break;

      case 'status-update':
        console.log('[Vapi Webhook] === STATUS UPDATE DETECTED ===');
        console.log('[Vapi Webhook] Message:', JSON.stringify(message, null, 2));
        await handleStatusUpdate(message, res);
        break;

      case 'end-of-call-report':
        console.log('[Vapi Webhook] === END OF CALL REPORT DETECTED ===');
        console.log('[Vapi Webhook] Message:', JSON.stringify(message, null, 2));
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
    console.log('\n📞 [Vapi Webhook] === ASSISTANT REQUEST ===');
    console.log('[Vapi Webhook] Phone Number:', phoneNumber);
    console.log('[Vapi Webhook] Call ID:', call?.id);
    console.log('[Vapi Webhook] Customer:', customer);

    // Extract metadata from the call (passed when creating the call via API)
    const metadata = call?.assistantOverrides?.metadata || call?.metadata || {};
    const { agentId, userId, campaignId, contactName, contactNotes } = metadata;

    console.log('[Vapi Webhook] Extracted Metadata:', metadata);
    console.log('[Vapi Webhook] Agent ID from metadata:', agentId);
    console.log('[Vapi Webhook] User ID from metadata:', userId);

    // For dashboard-configured assistants, look up agent by vapiAgentId
    const vapiAssistantId = call?.assistantId;
    console.log('[Vapi Webhook] Vapi Assistant ID from call:', vapiAssistantId);

    // Strategy 1: Look up by agentId from metadata (for API-created calls)
    let agent = null;
    let lookupMethod = '';

    if (agentId) {
      console.log('[Vapi Webhook] Strategy 1: Looking up agent by MongoDB ID:', agentId);
      agent = await Agent.findById(agentId);
      lookupMethod = 'MongoDB ID from metadata';
    }

    // Strategy 2: Look up by vapiAgentId (for dashboard-configured assistants)
    if (!agent && vapiAssistantId) {
      console.log('[Vapi Webhook] Strategy 2: Looking up agent by vapiAgentId:', vapiAssistantId);
      agent = await Agent.findOne({ vapiAgentId: vapiAssistantId });
      lookupMethod = 'vapiAgentId from call';
    }

    if (agent) {
      console.log(`\n✅ [Vapi Webhook] Agent FOUND via ${lookupMethod}: ${agent.name} (${agent.agentType})`);
      console.log('[Vapi Webhook] Agent Business Name:', agent.businessName);
      console.log('[Vapi Webhook] Agent Call Objective:', agent.callObjective);
      console.log('[Vapi Webhook] Agent has knowledgeFile:', !!agent.knowledgeFile);

        // Fetch user's business context (from knowledge documents)
        let businessContext: KnowledgeFile | null = null;
        if (userId) {
          const userKnowledge = await UserKnowledgeContext.findOne({ userId });
          if (userKnowledge?.knowledgeFile) {
            businessContext = userKnowledge.knowledgeFile as unknown as KnowledgeFile;
            console.log('[Vapi Webhook] ✅ Business context LOADED');
          } else {
            console.log('[Vapi Webhook] ⚠️ No business context found for user');
          }
        }

        // Build combined system prompt with agent context + business context + contact info
        console.log('[Vapi Webhook] Building system prompt...');
        let systemPrompt = buildCombinedSystemPrompt(agent, businessContext);
        console.log(`[Vapi Webhook] System prompt LENGTH: ${systemPrompt.length} characters`);
        console.log('[Vapi Webhook] System prompt PREVIEW:');
        console.log('---');
        console.log(systemPrompt.slice(0, 1000));
        console.log('...');
        console.log('---');

        // Add contact-specific context if available
        let firstMessage = getOpeningLine(agent);
        if (contactName) {
          firstMessage = `${firstMessage} Is this ${contactName}?`;
          systemPrompt += `\n\nCALL CONTEXT:\n• Contact Name: ${contactName}`;
          if (contactNotes) {
            systemPrompt += `\n• Previous Notes: ${contactNotes}`;
          }
          if (campaignId) {
            systemPrompt += `\n• This is an outbound campaign call`;
          }
        }

        console.log('[Vapi Webhook] Sending assistant config to Vapi...');
        console.log('[Vapi Webhook] Response includes systemPrompt:', systemPrompt.length > 0);
        console.log('[Vapi Webhook] Response firstMessage:', firstMessage);
        console.log('[Vapi Webhook] FULL systemPrompt being sent:');
        console.log('=== SYSTEM PROMPT START ===');
        console.log(systemPrompt);
        console.log('=== SYSTEM PROMPT END ===');

        res.json({
          assistant: {
            name: agent.name,
            firstMessage: firstMessage,
            voice: {
              provider: 'vapi',
              voiceId: agent.voiceId || 'joseph'
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
            serverUrlSecret: config.vapi.webhookSecret,
            endCallPhrases: ['goodbye', 'bye', 'hang up', 'end call'],
            maxDurationSeconds: 600
          }
        });
        console.log('✅ [Vapi Webhook] Assistant config SENT to Vapi\n');
        return;
    }

    // Agent not found - log why
    if (agentId) {
      console.log(`❌ [Vapi Webhook] Agent NOT FOUND by MongoDB ID: ${agentId}`);
    }
    if (vapiAssistantId) {
      console.log(`❌ [Vapi Webhook] Agent NOT FOUND by vapiAgentId: ${vapiAssistantId}`);
    }
    if (!agentId && !vapiAssistantId) {
      console.log('[Vapi Webhook] No agentId or vapiAssistantId provided - using fallback');
    }

    // Option 1: Return existing assistant ID from phone number
    if (phoneNumber?.assistantId) {
      res.json({
        assistantId: phoneNumber.assistantId
      });
      return;
    }

    // Fallback: Return a transient assistant config
    console.log('[Vapi Webhook] No agent found, using fallback assistant');
    res.json({
      assistant: {
        name: 'VoiceForge Assistant',
        firstMessage: 'Hello! Thanks for calling. How can I help you today?',
        voice: {
          provider: 'vapi',
          voiceId: 'Elliot'
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
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
        serverUrlSecret: config.vapi.webhookSecret,
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
 * Generate opening line based on agent type
 */
function getOpeningLine(agent: any): string {
  const lines: Record<string, string> = {
    marketing: `Hi! I'm ${agent.name} calling from ${agent.businessName}. Is this a good time?`,
    support: `Thank you for calling ${agent.businessName}. I'm ${agent.name}, how can I help?`,
    sales: `Hi, I'm ${agent.name} from ${agent.businessName}. I'm reaching out about our services — do you have a moment?`,
    tech: `${agent.businessName} tech support, this is ${agent.name}. How can I assist you today?`
  };
  return lines[agent.agentType] || lines.marketing;
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
    const { call, status, customer, phoneNumber } = message;
    const vapiCallId = call?.id;

    console.log(`[Vapi Webhook] Status update: ${status} for call ${vapiCallId}`);
    console.log('[Vapi Webhook] Full call object:', JSON.stringify(call, null, 2));

    if (vapiCallId) {
      const mappedStatus = mapVapiStatus(status);

      // Check if call log exists - if not, create it (for new calls)
      const existingLog = await CallLog.findOne({ vapiCallId });
      console.log(`[Vapi Webhook] Existing log:`, existingLog ? 'YES' : 'NO');

      if (!existingLog && (status === 'in-progress' || status === 'initiated')) {
        // Create new call log - try multiple locations for metadata
        const userId = call?.metadata?.userId || message?.userId;
        const agentId = call?.metadata?.agentId || message?.agentId;
        const direction = call?.type === 'inboundPhoneCall' ? 'inbound' : 'outbound';

        console.log(`[Vapi Webhook] Creating call log: userId=${userId}, agentId=${agentId}`);

        if (userId && agentId) {
          try {
            await CallLog.create({
              userId,
              agentId,
              vapiCallId,
              status: mappedStatus,
              direction,
              toNumber: customer?.number || call?.customer?.number,
              fromNumber: phoneNumber?.number || call?.phoneNumber?.number,
              startedAt: new Date()
            });
            console.log(`[Vapi Webhook] ✅ Created new call log for ${vapiCallId}`);
          } catch (createErr: any) {
            console.error('[Vapi Webhook] Failed to create call log:', createErr.message);
          }
        } else {
          console.log(`[Vapi Webhook] ⚠️ Cannot create call log: userId=${userId}, agentId=${agentId}`);
        }
      } else if (existingLog) {
        // Update existing
        await CallLog.findOneAndUpdate(
          { vapiCallId },
          { status: mappedStatus },
          { new: true }
        );
        console.log(`[Vapi Webhook] Updated call log status to ${mappedStatus}`);
      }
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
    console.log('[Vapi Webhook] Call data:', JSON.stringify({
      id: call?.id,
      type: call?.type,
      metadata: call?.metadata,
      startedAt: call?.startedAt,
      endedAt: call?.endedAt
    }, null, 2));

    if (!vapiCallId) {
      console.log('[Vapi Webhook] No vapiCallId, skipping');
      res.json({ received: true });
      return;
    }

    const startedAt = call?.startedAt ? new Date(call.startedAt) : new Date();
    const endedAt = call?.endedAt ? new Date(call.endedAt) : new Date();
    const durationSec = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));

    // Get call direction from existing CallLog or infer from call type
    let callLog = await CallLog.findOne({ vapiCallId });
    let direction = callLog?.direction || (call?.type === 'inboundPhoneCall' ? 'inbound' : 'outbound');

    // Calculate credits based on direction
    // Outbound: 3 credits/min, Inbound: 2 credits/min
    const costPerMin = direction === 'inbound' ? 2 : 3;
    const credits = Math.max(1, Math.ceil(durationSec / 60) * costPerMin); // Minimum 1 credit

    console.log(`[Vapi Webhook] Call ended: ${direction}, ${durationSec}s, ${credits} credits`);

    // Parse transcript from Vapi format (string) to our format (array)
    let parsedTranscript: Array<{role: string; text: string; timestamp: number}> = [];
    const baseTime = isNaN(startedAt.getTime()) ? Date.now() : startedAt.getTime();
    if (transcript && typeof transcript === 'string') {
      // Vapi sends transcript as "AI: ...\nUser: ...\n"
      const lines = transcript.split('\n').filter(line => line.trim());
      parsedTranscript = lines.map((line, index) => {
        const isAI = line.startsWith('AI:');
        const text = isAI ? line.substring(3).trim() : (line.startsWith('User:') ? line.substring(5).trim() : line);
        return {
          role: isAI ? 'assistant' : 'user',
          text: text,
          timestamp: baseTime + (index * 1000)
        };
      });
    } else if (Array.isArray(transcript)) {
      parsedTranscript = transcript.map((entry: any) => ({
        role: entry.role === 'bot' ? 'assistant' : entry.role,
        text: entry.message || entry.content || entry.text,
        timestamp: entry.time || entry.timestamp || Date.now()
      }));
    }

    // Extract metadata
    const userId = call?.metadata?.userId || message?.userId;
    const agentId = call?.metadata?.agentId || message?.agentId;

    if (callLog) {
      // Update existing call log
      callLog = await CallLog.findOneAndUpdate(
        { vapiCallId },
        {
          status: 'completed',
          transcript: parsedTranscript,
          durationSec,
          creditsUsed: credits,
          endedAt,
          startedAt,
          recordingUrl,
          summary
        },
        { new: true }
      );
      console.log(`[Vapi Webhook] Updated existing call log`);
    } else if (userId && agentId) {
      // Create new call log if it doesn't exist (e.g., if status-update was missed)
      callLog = await CallLog.create({
        userId,
        agentId,
        vapiCallId,
        status: 'completed',
        direction,
        toNumber: call?.customer?.number,
        fromNumber: call?.phoneNumber?.number,
        transcript: parsedTranscript,
        durationSec,
        creditsUsed: credits,
        startedAt,
        endedAt,
        recordingUrl,
        summary
      });
      console.log(`[Vapi Webhook] Created call log in end-of-call-report`);
    } else {
      console.log(`[Vapi Webhook] ⚠️ Cannot create/update call log: missing userId=${userId}, agentId=${agentId}`);
    }

    if (callLog) {
      // Deduct credits
      const previousCredits = await User.findById(callLog.userId).select('credits');
      await User.findByIdAndUpdate(callLog.userId, { $inc: { credits: -credits } });
      console.log(`[Vapi Webhook] Deducted ${credits} credits from user ${callLog.userId}`);
      console.log(`[Vapi Webhook] Credits before: ${previousCredits?.credits || 'unknown'}, after: ${(previousCredits?.credits || 0) - credits}`);

      // Record in ledger
      await CreditLedger.create({
        userId: callLog.userId,
        type: 'deduct',
        amount: -credits,
        description: `${direction} call ${durationSec}s (${costPerMin}/min)`,
        callLogId: callLog._id
      });
      console.log(`[Vapi Webhook] Created credit ledger entry`);

      // Update campaign stats if applicable
      if (callLog.csvContactId && callLog.campaignId) {
        const isAnswered = transcript && transcript.length > 1;

        await CsvContact.findByIdAndUpdate(callLog.csvContactId, {
          status: isAnswered ? 'answered' : 'no-answer',
          callLogId: callLog._id,
          calledAt: new Date()
        });

        await Campaign.findByIdAndUpdate(callLog.campaignId, {
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
