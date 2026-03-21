import { create } from 'zustand';
import type { Campaign } from '@/lib/types';

interface CampaignState {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  setCampaigns: (campaigns: Campaign[]) => void;
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  setActiveCampaign: (id: string | null) => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
  campaigns: [],
  activeCampaignId: null,
  setCampaigns: (campaigns) => set({ campaigns }),
  addCampaign: (campaign) =>
    set((state) => ({ campaigns: [campaign, ...state.campaigns] })),
  updateCampaign: (id, updates) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      )
    })),
  setActiveCampaign: (id) => set({ activeCampaignId: id })
}));
