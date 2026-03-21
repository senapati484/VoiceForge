import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession } from 'next-auth/react';
import type {
  Agent,
  CallLog,
  Campaign,
  CsvContact,
  CreateAgentInput,
  KnowledgeDoc,
  StoredKnowledgeContext,
  VoiceOption,
  CreditTransaction,
  User
} from './types';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const API_BASE_URL = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`;

// Create axios instance
const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
http.interceptors.request.use(
  async (config) => {
    const session = await getSession();
    if (session?.backendToken) {
      config.headers.Authorization = `Bearer ${session.backendToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string; issues?: string[] }>) => {
    const issues = error.response?.data?.issues;
    const message =
      issues && issues.length > 0
        ? `Validation failed: ${issues.join(', ')}`
        : (error.response?.data?.error || error.message || 'An error occurred');
    return Promise.reject(new Error(message));
  }
);

// Agents API
function normalizeAgent(agent: Agent & { _id?: string }): Agent {
  return {
    ...agent,
    id: agent.id || agent._id || ''
  };
}

export const agentsApi = {
  list: async (): Promise<Agent[]> => {
    const res = await http.get('/agents');
    return (res.data.agents as Array<Agent & { _id?: string }>).map(normalizeAgent);
  },
  create: async (data: CreateAgentInput): Promise<Agent> => {
    const res = await http.post('/agents', data);
    return normalizeAgent(res.data.agent as Agent & { _id?: string });
  },
  get: async (id: string): Promise<Agent> => {
    const res = await http.get(`/agents/${id}`);
    return normalizeAgent(res.data.agent as Agent & { _id?: string });
  },
  update: async (
    id: string,
    data: Partial<CreateAgentInput> & { isActive?: boolean }
  ): Promise<Agent> => {
    const res = await http.patch(`/agents/${id}`, data);
    return normalizeAgent(res.data.agent as Agent & { _id?: string });
  },
  delete: async (id: string): Promise<void> => {
    await http.delete(`/agents/${id}`);
  },
  regenerateContext: async (id: string): Promise<{ success: boolean; knowledgeFile: unknown }> => {
    const res = await http.get(`/agents/${id}/regenerate-context`);
    return res.data;
  }
};

// Voices API
export const voicesApi = {
  list: async (): Promise<VoiceOption[]> => {
    const res = await http.get('/voices');
    return res.data.voices;
  }
};

// Calls API
export const callsApi = {
  list: async (page = 1): Promise<{ calls: CallLog[]; page: number }> => {
    const res = await http.get('/calls', { params: { page } });
    return res.data;
  },
  get: async (id: string): Promise<CallLog> => {
    const res = await http.get(`/calls/${id}`);
    return res.data.call;
  },
  outbound: async (agentId: string, toNumber: string): Promise<{ callId: string; vapiCallId: string }> => {
    const res = await http.post('/calls/outbound', { agentId, toNumber });
    return res.data;
  }
};

// Knowledge API
export const knowledgeApi = {
  upload: async (formData: FormData): Promise<{ docId: string; status: string }> => {
    const res = await http.post('/knowledge/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  scrape: async (url: string, agentId?: string): Promise<{ docId: string; status: string }> => {
    const res = await http.post('/knowledge/scrape', { url, agentId });
    return res.data;
  },
  status: async (docId: string): Promise<KnowledgeDoc> => {
    if (!docId || docId === 'undefined') {
      throw new Error('Invalid document id');
    }
    const res = await http.get(`/knowledge/status/${docId}`);
    return res.data;
  },
  list: async (): Promise<KnowledgeDoc[]> => {
    const res = await http.get('/knowledge');
    return res.data.docs;
  },
  delete: async (docId: string): Promise<void> => {
    await http.delete(`/knowledge/${docId}`);
  },
  generateContext: async (
    agentType?: 'marketing' | 'support' | 'sales' | 'tech'
  ): Promise<{ success: boolean; knowledgeFile: unknown; context?: { generatedAt?: string } }> => {
    const res = await http.post('/knowledge/generate-context', { agentType: agentType ?? 'support' });
    return res.data;
  },
  getContext: async (): Promise<StoredKnowledgeContext | null> => {
    const res = await http.get('/knowledge/context');
    return res.data.context ?? null;
  }
};

// Credits API
export const creditsApi = {
  get: async (): Promise<{ credits: number; transactions: CreditTransaction[] }> => {
    const res = await http.get('/credits');
    return res.data;
  },
  purchase: async (packId: 'starter' | 'growth' | 'business'): Promise<{ success: boolean; creditsAdded: number; newTotal: number }> => {
    const res = await http.post('/credits/purchase', { packId });
    return res.data;
  }
};

// Campaigns API
export const campaignsApi = {
  list: async (): Promise<Campaign[]> => {
    const res = await http.get('/campaigns');
    return res.data.campaigns;
  },
  create: async (formData: FormData): Promise<{ campaign: Campaign; contactCount: number }> => {
    const res = await http.post('/campaigns', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  get: async (id: string): Promise<Campaign> => {
    const res = await http.get(`/campaigns/${id}`);
    return res.data.campaign;
  },
  getContacts: async (id: string, page = 1): Promise<{ contacts: CsvContact[]; total: number; page: number }> => {
    const res = await http.get(`/campaigns/${id}/contacts`, { params: { page } });
    return res.data;
  },
  start: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await http.post(`/campaigns/${id}/start`);
    return res.data;
  },
  pause: async (id: string): Promise<{ success: boolean }> => {
    const res = await http.post(`/campaigns/${id}/pause`);
    return res.data;
  }
};

// Auth API
export const authApi = {
  me: async (): Promise<User> => {
    const res = await http.get('/auth/me');
    return res.data.user;
  }
};

export const api = {
  agents: agentsApi,
  voices: voicesApi,
  calls: callsApi,
  knowledge: knowledgeApi,
  credits: creditsApi,
  campaigns: campaignsApi,
  auth: authApi,
};

export default http;
