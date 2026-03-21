import { create } from 'zustand';
import type { Agent, CreateAgentInput } from '@/lib/types';

interface AgentState {
  agents: Agent[];
  draft: Partial<CreateAgentInput>;
  setAgents: (agents: Agent[]) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (id: string) => void;
  updateDraft: (draft: Partial<CreateAgentInput>) => void;
  clearDraft: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  draft: {
    language: 'en-US',
    tone: 'professional'
  },
  setAgents: (agents) => set({ agents }),
  addAgent: (agent) => set((state) => ({ agents: [agent, ...state.agents] })),
  removeAgent: (id) => set((state) => ({ agents: state.agents.filter((a) => a.id !== id) })),
  updateDraft: (draft) => set((state) => ({ draft: { ...state.draft, ...draft } })),
  clearDraft: () => set({ draft: { language: 'en-US', tone: 'professional' } })
}));
