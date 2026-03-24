import 'dotenv/config';

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing: ${k}`);
  return v;
}

function firstEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function reqAny(keys: string[]): string {
  const value = firstEnv(keys);
  if (!value) throw new Error(`Missing one of: ${keys.join(', ')}`);
  return value;
}

function optionalInt(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalFloat(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalList(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function bucketFromS3ApiUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+/, '');
    return path.split('/')[0] || undefined;
  } catch {
    return undefined;
  }
}

function accountFromEndpoint(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    return hostParts[0] || undefined;
  } catch {
    return undefined;
  }
}

function normalizeEndpoint(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

function ensureR2Config(r2: {
  accountId: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  endpoint: string;
}): void {
  if (r2.accessKey.length !== 32) {
    throw new Error(`Invalid R2 access key length: ${r2.accessKey.length}. Expected 32.`);
  }
  if (!r2.bucket.trim()) {
    throw new Error('R2 bucket is empty.');
  }
  if (!r2.endpoint.startsWith('https://')) {
    throw new Error(`R2 endpoint must start with https://. Received: ${r2.endpoint}`);
  }
  const endpointPath = new URL(r2.endpoint).pathname;
  if (endpointPath && endpointPath !== '/') {
    throw new Error(`R2 endpoint must not contain bucket/path. Received: ${r2.endpoint}`);
  }
}

const r2AccountId =
  firstEnv(['R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID']) ||
  accountFromEndpoint(firstEnv(['AWS_ENDPOINT_URL', 'CLOUDFLARE_S3_API'])) ||
  reqAny(['R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID']);

const r2Endpoint = normalizeEndpoint(
  firstEnv(['AWS_ENDPOINT_URL']) || `https://${r2AccountId}.r2.cloudflarestorage.com`
);

const r2Config = {
  accountId: r2AccountId,
  accessKey: reqAny(['R2_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID']),
  secretKey: reqAny(['R2_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY']),
  bucket:
    firstEnv(['R2_BUCKET_NAME', 'AWS_BUCKET_NAME']) ||
    bucketFromS3ApiUrl(firstEnv(['CLOUDFLARE_S3_API'])) ||
    reqAny(['R2_BUCKET_NAME', 'AWS_BUCKET_NAME']),
  endpoint: r2Endpoint
};

ensureR2Config(r2Config);

export const config = {
  port: parseInt(process.env.PORT || '4000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: req('MONGODB_URI'),
  jwt: { secret: req('JWT_SECRET'), expiresIn: '7d' },
  // Smolify — optional fallback; deprecated in favor of Gemini
  smolify: {
    apiKey: firstEnv(['SMOLIFY_API_KEY']),
    baseUrl: 'https://api.smolify.com/v1',
    model: process.env.SMOLIFY_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct'
  },
  // Gemini — for context extraction (multimodal PDF support)
  gemini: {
    apiKey: firstEnv(['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    extractionModel: process.env.GEMINI_EXTRACTION_MODEL || 'gemini-2.5-flash',
    maxRetries: optionalInt(process.env.GEMINI_MAX_RETRIES) ?? 2,
    maxOutputTokens: optionalInt(process.env.GEMINI_MAX_OUTPUT_TOKENS) ?? 800,
    contextMaxOutputTokens: optionalInt(process.env.GEMINI_CONTEXT_MAX_OUTPUT_TOKENS) ?? 800,
    agentContextMaxOutputTokens:
      optionalInt(process.env.GEMINI_AGENT_CONTEXT_MAX_OUTPUT_TOKENS) ?? 1000,
    topP: optionalFloat(process.env.GEMINI_TOP_P),
    topK: optionalInt(process.env.GEMINI_TOP_K),
    stopSequences: optionalList(process.env.GEMINI_STOP_SEQUENCES)
  },
  // Groq — primary LLM for voice calls (fast, low latency)
  groq: {
    apiKey: firstEnv(['GROQ_API_KEY']),
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant', // Default to 8B for speed
    voiceModel: process.env.GROQ_VOICE_MODEL || 'llama-3.1-8b-instant', // Fast responses
    contextModel: process.env.GROQ_CONTEXT_MODEL || 'llama-3.3-70b-versatile' // Accurate extraction
  },
  context: {
    provider: (process.env.CONTEXT_PROVIDER || 'gemini') as 'hf' | 'gemini' | 'groq'
  },
  hf: {
    modelId: process.env.HF_MODEL_ID || 'Sayan25/smolified-file-context-extractor',
    apiToken: firstEnv(['HF_API_TOKEN', 'HUGGINGFACEHUB_API_TOKEN']),
    inferenceUrl: process.env.HF_INFERENCE_URL
  },
  r2: r2Config,
  vapi: {
    apiKey: req('VAPI_API_KEY'),
    webhookSecret: req('VAPI_WEBHOOK_SECRET')
  },
  pinecone: {
    apiKey: firstEnv(['PINECONE_API_KEY']),
    index: firstEnv(['PINECONE_INDEX'])
  },
  email: {
    host: 'smtp.gmail.com',
    port: 587,
    user: req('SMTP_USER'),
    pass: req('SMTP_PASS'),
    from: '"VoiceForge" <noreply@voiceforge.ai>'
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiPublicUrl: process.env.API_PUBLIC_URL || 'http://localhost:4000',
  ragEnabled: Boolean(
    process.env.RAG_ENABLED === 'true' &&
    firstEnv(['GEMINI_API_KEY', 'GOOGLE_API_KEY']) &&
    firstEnv(['PINECONE_API_KEY']) &&
    firstEnv(['PINECONE_INDEX'])
  )
} as const;
