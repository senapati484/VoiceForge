# VoiceForge Architecture Migration Roadmap
## Groq for Voice + Gemini 1.5 for Context + Compact Context Format

---

## Executive Summary

Migrate from single-provider (Groq) to dual-provider architecture:
- **Gemini 1.5 Flash** for document context extraction (cheaper, better PDF understanding)
- **Groq 8B** for real-time voice responses (fastest, lowest latency)
- **Compact Context Format** for 70% token reduction in voice calls

---

## Phase 1: Configuration & Types (Day 1)

### 1.1 Update Config Schema
**File:** `voiceforge-api/src/config.ts`

**Changes:**
```typescript
// Add to gemini config (line ~129)
gemini: {
  apiKey: firstEnv(['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
  model: process.env.GEMINI_MODEL || 'gemini-1.5-flash', // Changed from 2.5 to 1.5
  extractionModel: process.env.GEMINI_EXTRACTION_MODEL || 'gemini-1.5-flash', // Separate model for extraction
  // ... existing fields
}

// Update groq config (line ~142)
groq: {
  apiKey: firstEnv(['GROQ_API_KEY']),
  model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant', // Changed from 70b to 8b for voice
  voiceModel: process.env.GROQ_VOICE_MODEL || 'llama-3.1-8b-instant',
  contextModel: process.env.GROQ_CONTEXT_MODEL || 'llama-3.3-70b-versatile' // Fallback for extraction
}
```

**New Env Vars:**
```bash
# .env additions
GEMINI_EXTRACTION_MODEL=gemini-1.5-flash
GROQ_VOICE_MODEL=llama-3.1-8b-instant
GROQ_CONTEXT_MODEL=llama-3.3-70b-versatile
CONTEXT_PROVIDER=gemini  # 'gemini' | 'groq' | 'hf'
```

### 1.2 Define Compact Context Types
**File:** `voiceforge-api/src/types/compactContext.ts` (NEW)

```typescript
/**
 * Compact Context Format v2
 * Token-optimized representation of knowledge for AI consumption
 */
export interface CompactContextV2 {
  v: 2;                          // Version
  a: string;                     // Agent/business summary (max 100 chars)
  p: string[];                   // Products: "name|price|desc" (max 50 chars each)
  f: string[];                   // Facts (max 40 chars each)
  q: string[];                   // Q&A: "question|answer" (max 80 chars each)
  e: string[];                   // Escalation triggers
  t: string;                     // Tone
  r: string;                     // Response rules
}

/**
 * Legacy KnowledgeFile (current format)
 * Keep for backward compatibility during migration
 */
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

// Union type for transition period
export type KnowledgeContext = KnowledgeFile | CompactContextV2;

// Type guard
export function isCompactContext(ctx: KnowledgeContext): ctx is CompactContextV2 {
  return (ctx as CompactContextV2).v === 2;
}
```

### 1.3 Update Database Schema
**File:** `voiceforge-api/src/db/models/UserKnowledgeContext.ts`

**Changes:**
```typescript
export interface IUserKnowledgeContext extends Document {
  userId: Types.ObjectId;
  knowledgeFile: Record<string, unknown>; // Keep as-is for flexibility
  compactContext?: CompactContextV2;       // NEW: Store compact format
  generatedAt: Date;
  version: number;                          // NEW: Track format version
}

const UserKnowledgeContextSchema = new Schema<IUserKnowledgeContext>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  knowledgeFile: { type: Schema.Types.Mixed, required: true },
  compactContext: { type: Schema.Types.Mixed, required: false }, // NEW
  generatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 } // NEW: 1=legacy, 2=compact
});
```

**Migration Strategy:**
- Keep `knowledgeFile` populated for backward compatibility
- Add `compactContext` field
- Add `version` field to track format
- Backfill existing records on first read

---

## Phase 2: Gemini Context Extraction (Day 2-3)

### 2.1 Create Gemini Service
**File:** `voiceforge-api/src/services/gemini.service.ts` (NEW)

**Responsibilities:**
- PDF/multimodal document upload to Gemini
- Structured JSON extraction
- Retry logic with exponential backoff
- Fallback to Groq if Gemini fails

**Key Functions:**
```typescript
/**
 * Extract structured knowledge from document using Gemini 1.5 Flash
 * Supports native PDF upload (multimodal)
 */
export async function extractWithGemini(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<KnowledgeFile>;

/**
 * Upload file to Gemini Files API for native PDF processing
 */
async function uploadToGemini(
  buffer: Buffer,
  mimeType: string
): Promise<string>; // Returns file URI

/**
 * Extract with fallback chain: Gemini -> Groq -> Local
 */
export async function extractWithFallback(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<KnowledgeFile>;
```

**Gemini Prompt:**
```typescript
const GEMINI_EXTRACTION_PROMPT = `
Analyze this document and extract structured business information.
Return ONLY valid JSON matching this schema:

{
  "businessSummary": "2-3 sentence summary",
  "keyProducts": [{"name": "...", "price": "...", "description": "...", "features": ["..."]}],
  "commonQA": [{"question": "...", "answer": "..."}],
  "importantFacts": ["..."],
  "escalationTriggers": ["..."]
}

Rules:
1. If document contains tables/charts, extract key data points
2. If document has images/diagrams, describe their content
3. Never return empty arrays - infer from context
4. businessSummary is REQUIRED
5. Include at least 3 key products, 3 Q&A pairs, 5 facts
`;
```

### 2.2 Update Context Builder Service
**File:** `voiceforge-api/src/services/contextBuilder.service.ts`

**Changes:**

**A. Add Provider Selection (line ~374):**
```typescript
// Replace hardcoded Groq with provider selection
async function extractKnowledgeWithAI(
  text: string,
  buffer?: Buffer,       // NEW: For multimodal upload
  mimeType?: string      // NEW: Document type
): Promise<KnowledgeFile> {
  const provider = config.context.provider;

  switch (provider) {
    case 'gemini':
      return extractWithGemini(buffer || Buffer.from(text), mimeType || 'text/plain');
    case 'groq':
      return extractWithGroq(text); // Existing logic
    case 'hf':
      return extractWithHF(text);   // Existing logic
    default:
      return extractWithGroq(text); // Fallback
  }
}
```

**B. Update buildKnowledgeFile (line ~290):**
```typescript
export async function buildKnowledgeFile(userId: string): Promise<KnowledgeFile> {
  // ... existing document fetching logic ...

  for (const doc of docs) {
    // Pass buffer for Gemini to enable native PDF processing
    const buffer = await getFileBufferFromR2(doc.r2Key);
    const text = await extractTextFromDoc(doc);

    // Use Gemini with buffer for multimodal support
    const knowledge = await extractKnowledgeWithAI(text, buffer, doc.type);
    extractions.push(knowledge);
  }

  // ... merge logic ...
}
```

### 2.3 Package Installation
```bash
cd voiceforge-api
npm install @google/generative-ai
```

---

## Phase 3: Compact Context Format (Day 3-4)

### 3.1 Create Compression Utilities
**File:** `voiceforge-api/src/services/compactContext.service.ts` (NEW)

```typescript
import type { KnowledgeFile, CompactContextV2 } from '../types/compactContext';

const MAX_SUMMARY_LEN = 100;
const MAX_PRODUCT_LEN = 50;
const MAX_FACT_LEN = 40;
const MAX_QA_LEN = 80;

/**
 * Compress verbose KnowledgeFile to compact format
 * Reduces token count by ~60-70%
 */
export function compressKnowledgeFile(
  kf: KnowledgeFile,
  agent: { tone: string; callObjective: string }
): CompactContextV2 {
  return {
    v: 2,
    a: truncate(kf.businessSummary, MAX_SUMMARY_LEN),
    p: kf.keyProducts.slice(0, 5).map(p =>
      `${truncate(p.name, 20)}|${p.price || '-'}|${truncate(p.description, MAX_PRODUCT_LEN)}`
    ),
    f: kf.importantFacts.slice(0, 8).map(f => truncate(f, MAX_FACT_LEN)),
    q: kf.commonQA.slice(0, 5).map(qa =>
      `${truncate(qa.question, 30)}|${truncate(qa.answer, MAX_QA_LEN)}`
    ),
    e: kf.escalationTriggers.slice(0, 5),
    t: agent.tone,
    r: "1-2 sentences"
  };
}

/**
 * Expand compact context to human-readable prompt
 * For use in voice LLM calls
 */
export function expandCompactContext(
  compact: CompactContextV2,
  agent: { name: string; agentType: string; businessName: string; callObjective: string }
): string {
  const parts: string[] = [];

  // Identity
  parts.push(`You are ${agent.name}, ${compact.t} ${agent.agentType} agent for ${agent.businessName}.`);
  parts.push(`Goal: ${agent.callObjective}`);

  // Business context
  parts.push(`\nAbout: ${compact.a}`);

  // Products
  if (compact.p.length) {
    parts.push('\nProducts:');
    compact.p.forEach(p => {
      const [name, price, desc] = p.split('|');
      parts.push(`- ${name}${price !== '-' ? ` (${price})` : ''}: ${desc}`);
    });
  }

  // Facts
  if (compact.f.length) {
    parts.push('\nKey Facts: ' + compact.f.join('; '));
  }

  // Q&A
  if (compact.q.length) {
    parts.push('\nCommon Questions:');
    compact.q.forEach(q => {
      const [question, answer] = q.split('|');
      parts.push(`Q: ${question}\nA: ${answer}`);
    });
  }

  // Escalation
  parts.push(`\nEscalate when: ${compact.e.join(', ')}`);

  // Rules
  parts.push(`\nRules: ${compact.r}. Tone: ${compact.t}.`);

  return parts.join('\n');
}

function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 3) + '...';
}
```

### 3.2 Update Knowledge Routes
**File:** `voiceforge-api/src/routes/knowledge.ts`

**Changes:**

**A. Update generate-context endpoint (line ~425):**
```typescript
router.post('/generate-context', validate(generateContextSchema), async (req, res, next) => {
  // ... existing logic ...

  const knowledgeFile = await buildKnowledgeFile(userId);

  // NEW: Compress to compact format
  const { compressKnowledgeFile } = await import('../services/compactContext.service');
  const compactContext = compressKnowledgeFile(knowledgeFile, agent);

  // Save both formats
  const saved = await UserKnowledgeContext.findOneAndUpdate(
    { userId },
    {
      userId,
      knowledgeFile,        // Legacy format (backward compat)
      compactContext,        // NEW: Compact format
      generatedAt: new Date(),
      version: 2             // NEW
    },
    { upsert: true, new: true }
  );

  // ... response ...
});
```

### 3.3 Update Prompt Builder
**File:** `voiceforge-api/src/services/contextBuilder.service.ts`

**Changes to buildCombinedSystemPrompt (line ~696):**
```typescript
export function buildCombinedSystemPrompt(
  agent: IAgent,
  businessContext?: KnowledgeFile | CompactContextV2 | null
): string {
  // Check if compact format
  if (businessContext && isCompactContext(businessContext)) {
    return expandCompactContext(businessContext, agent);
  }

  // Legacy verbose format (existing logic)
  // ... keep existing code for backward compatibility ...
}
```

---

## Phase 4: Voice Processing Optimization (Day 4)

### 4.1 Verify Groq Configuration
**File:** `voiceforge-api/src/routes/llm.ts`

**Current State:**
```typescript
// Line 8 - Already using 8B for voice
const GROQ_MODEL = 'llama-3.1-8b-instant'; // Fastest model for voice
```

**No changes needed** - already optimized!

### 4.2 Update Vapi Webhook
**File:** `voiceforge-api/src/routes/vapi/webhook.ts`

**Changes (line ~165):**
```typescript
async function handleAssistantRequest(message: any, res: Response): Promise<void> {
  // ... existing logic ...

  // Fetch business context
  let businessContext: KnowledgeFile | CompactContextV2 | null = null;
  if (userId) {
    const userKnowledge = await UserKnowledgeContext.findOne({ userId });
    if (userKnowledge?.compactContext) {
      // NEW: Prefer compact format
      businessContext = userKnowledge.compactContext as CompactContextV2;
    } else if (userKnowledge?.knowledgeFile) {
      // Fallback to legacy
      businessContext = userKnowledge.knowledgeFile as KnowledgeFile;
    }
  }

  // Build prompt with compact context
  let systemPrompt = buildCombinedSystemPrompt(agent, businessContext);

  // ... rest of logic ...
}
```

---

## Phase 5: Migration & Testing (Day 5)

### 5.1 Migration Script
**File:** `voiceforge-api/src/scripts/migrateToCompactContext.ts` (NEW)

```typescript
/**
 * One-time migration script
 * Converts existing knowledgeFile to compactContext
 */
export async function migrateToCompactContext(): Promise<void> {
  const contexts = await UserKnowledgeContext.find({ version: { $ne: 2 } });

  for (const ctx of contexts) {
    if (!ctx.compactContext && ctx.knowledgeFile) {
      // Get agent info for tone
      const agent = await Agent.findOne({ userId: ctx.userId });

      ctx.compactContext = compressKnowledgeFile(
        ctx.knowledgeFile as KnowledgeFile,
        { tone: agent?.tone || 'professional', callObjective: agent?.callObjective || '' }
      );
      ctx.version = 2;
      await ctx.save();
    }
  }
}
```

### 5.2 Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Upload PDF → Generate Context | Uses Gemini 1.5, returns compact format |
| Verify token count | Compact uses 60-70% fewer tokens |
| Voice call with compact context | Faster response, lower latency |
| Fallback to Groq | If Gemini fails, uses Groq |
| Backward compatibility | Old contexts still work |
| Migration script | All records migrated successfully |

### 5.3 Monitoring & Metrics

Add logging to track:
- Token savings: `(oldTokens - newTokens) / oldTokens * 100`
- Extraction time: Gemini vs Groq
- Voice response latency
- Fallback usage rate

---

## File Changes Summary

### New Files (5)
1. `src/types/compactContext.ts` - Type definitions
2. `src/services/gemini.service.ts` - Gemini integration
3. `src/services/compactContext.service.ts` - Compression/expansion
4. `src/scripts/migrateToCompactContext.ts` - Migration script
5. `tests/compactContext.test.ts` - Unit tests

### Modified Files (7)
1. `src/config.ts` - Add new config options
2. `src/db/models/UserKnowledgeContext.ts` - Add compactContext field
3. `src/services/contextBuilder.service.ts` - Gemini integration + compact support
4. `src/routes/knowledge.ts` - Use compact format
5. `src/routes/vapi/webhook.ts` - Use compact context
6. `.env.example` - New env vars
7. `package.json` - Add @google/generative-ai

### No Changes Needed (2)
- `src/routes/llm.ts` - Already using Groq 8B
- `src/config.ts` - Gemini config already exists

---

## Rollback Plan

If issues arise:

1. **Switch provider:** Change `CONTEXT_PROVIDER=groq` in .env
2. **Disable compact:** Remove compactContext usage, fall back to knowledgeFile
3. **Database:** Keep both formats, easy to revert
4. **Code:** All changes are backward compatible

---

## Expected Outcomes

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Context extraction cost | $0.59/1M tokens | $0.075/1M tokens | **8x cheaper** |
| Voice response latency | ~50ms | ~15ms | **3x faster** |
| System prompt tokens | ~800 | ~250 | **70% smaller** |
| PDF understanding | Text only | Multimodal | **Native vision** |
| Context window | 8K tokens | 1M tokens | **125x larger** |

---

## Implementation Order

**Week 1:**
- Day 1: Phase 1 (Config & Types)
- Day 2: Phase 2 (Gemini Service)
- Day 3: Phase 2 (Integration)
- Day 4: Phase 3 (Compact Format)
- Day 5: Phase 4-5 (Voice + Testing)

**Dependencies:**
- Config → Gemini Service → Context Builder → Knowledge Routes → Testing

---

Ready to implement? Start with Phase 1 and work through sequentially.
