import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config';
import { connectDB } from './db/mongoose';
import { startWorker } from './services/worker';

// Routes
import authRoutes from './routes/auth';
import agentRoutes from './routes/agents';
import callRoutes from './routes/calls';
import knowledgeRoutes from './routes/knowledge';
import creditRoutes from './routes/credits';
import voiceRoutes from './routes/voices';
import campaignRoutes from './routes/campaigns';
import llmRoutes from './routes/llm';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { webhookHandler } from './routes/calls/webhook';
import { vapiWebhookHandler } from './routes/vapi/webhook';

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));

// 3. Request logging
app.use(morgan('dev'));

// 4. RAW body parser for Vapi webhooks ONLY — MUST be before express.json()
// Legacy webhook endpoint (backward compatibility)
app.use('/api/calls/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// Webhook test endpoint - simple ping to verify accessibility (MUST be before the POST handler)
app.get('/vapi/webhook', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    endpoints: {
      POST: '/vapi/webhook - Main webhook handler',
      GET: '/vapi/webhook - This test endpoint'
    }
  });
});

// New Vapi webhook endpoint with full event support (POST only)
app.post('/vapi/webhook', express.json({ limit: '10mb' }), vapiWebhookHandler);

// 5. JSON body parser
app.use(express.json({ limit: '10mb' }));

// 6. URL encoded
app.use(express.urlencoded({ extended: true }));

// 7. Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/voices', voiceRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/llm', llmRoutes);

// Vapi-specific routes
import { getToolDefinitions, handleToolRequest } from './routes/vapi/tools';
app.get('/vapi/tools', getToolDefinitions);
app.post('/vapi/tools/:toolName', handleToolRequest);

// 8. Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date() });
});

// 9. Error handler (last)
app.use(errorHandler);

async function main(): Promise<void> {
  await connectDB();

  // Startup configuration logging
  console.log('\n═══════════════════════════════════════════════════');
  console.log('🚀 VoiceForge API Starting...');
  console.log('═══════════════════════════════════════════════════');
  console.log('📡 API_PUBLIC_URL:', config.apiPublicUrl);
  console.log('🔗 Webhook URL:', `${config.apiPublicUrl}/vapi/webhook`);
  console.log('🤖 LLM Endpoint:', `${config.apiPublicUrl}/api/llm/chat/completions`);
  console.log('🔑 Vapi API Key:', config.vapi.apiKey ? '✅ Set' : '❌ Missing');
  console.log('🌐 Frontend URL:', config.frontendUrl);
  console.log('═══════════════════════════════════════════════════\n');

  app.listen(config.port, () => {
    console.log(`⚡ API on port ${config.port}`);
  });
  startWorker();
}

main().catch(console.error);
