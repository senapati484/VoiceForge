import { create } from 'zustand';
import type { CallLog } from '@/lib/types';

interface CallState {
  calls: CallLog[];
  activeCallId: string | null;
  activeStatus: 'dialing' | 'connected' | 'ended' | null;
  setCalls: (calls: CallLog[]) => void;
  setActiveCall: (id: string | null) => void;
  setActiveStatus: (status: 'dialing' | 'connected' | 'ended' | null) => void;
  addCall: (call: CallLog) => void;
  updateCall: (id: string, updates: Partial<CallLog>) => void;
}

export const useCallStore = create<CallState>((set) => ({
  calls: [],
  activeCallId: null,
  activeStatus: null,
  setCalls: (calls) => set({ calls }),
  setActiveCall: (id) => set({ activeCallId: id }),
  setActiveStatus: (status) => set({ activeStatus: status }),
  addCall: (call) => set((state) => ({ calls: [call, ...state.calls] })),
  updateCall: (id, updates) =>
    set((state) => ({
      calls: state.calls.map((c) => (c.id === id ? { ...c, ...updates } : c))
    }))
}));
