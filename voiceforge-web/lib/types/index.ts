// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  credits: number;
  plan: string;
}

// Knowledge File Types
export interface KnowledgeFile {
  businessSummary: string;
  keyProducts: {
    name: string;
    price?: string;
    description: string;
    features: string[];
  }[];
  commonQA: {
    question: string;
    answer: string;
  }[];
  importantFacts: string[];
  escalationTriggers: string[];
}

export interface StoredKnowledgeContext {
  id: string;
  knowledgeFile: KnowledgeFile;
  generatedAt: string;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  agentType: 'marketing' | 'support' | 'sales' | 'tech';
  businessName: string;
  description: string;
  voiceId: string;
  voiceName: string;
  vapiAgentId?: string;
  phoneNumber?: string;
  isActive: boolean;
  language: string;
  tone: string;
  callObjective: string;
  knowledgeDocs: string[];
  knowledgeFile?: KnowledgeFile;
  knowledgeFileGeneratedAt?: string;
  createdAt: string;
}

// Knowledge Document Types
export interface KnowledgeDoc {
  id: string;
  type: 'pdf' | 'docx' | 'txt' | 'scrape' | 'csv';
  filename?: string;
  sourceUrl?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  chunkCount?: number;
  errorMsg?: string;
}

// Campaign Types
export interface Campaign {
  id: string;
  agentId: string;
  agentName?: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  totalContacts: number;
  called: number;
  answered: number;
  converted: number;
  noAnswer: number;
  failed: number;
  createdAt: string;
}

// CSV Contact Types
export interface CsvContact {
  id: string;
  campaignId: string;
  name: string;
  phone: string;
  notes?: string;
  status: 'pending' | 'calling' | 'answered' | 'no-answer' | 'converted' | 'failed';
  calledAt?: string;
}

// Call Log Types
export interface TranscriptEntry {
  role: 'agent' | 'user';
  text: string;
  timestamp: number;
}

export interface CallLog {
  id: string;
  agentId: string;
  agentName?: string;
  campaignId?: string;
  direction: 'inbound' | 'outbound';
  toNumber?: string;
  status: string;
  durationSec?: number;
  transcript?: TranscriptEntry[];
  creditsUsed?: number;
  createdAt: string;
}

// Form Input Types
export interface CreateAgentInput {
  name: string;
  agentType: string;
  businessName: string;
  description: string;
  voiceId: string;
  voiceName: string;
  language: string;
  tone: string;
  callObjective: string;
}

// Voice Types
export interface VoiceOption {
  voiceId: string;
  name: string;
  provider: string;
  previewUrl?: string;
}

// Credit Transaction Types
export interface CreditTransaction {
  id: string;
  type: 'purchase' | 'deduct' | 'refund' | 'bonus';
  amount: number;
  description: string;
  createdAt: string;
}
