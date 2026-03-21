import { create } from 'zustand';
import type { User } from '@/lib/types';
import { authApi } from '@/lib/api';

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  hydrate: () => Promise<void>;
  updateCredits: (delta: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  hydrate: async () => {
    try {
      const user = await authApi.me();
      set({ user });
    } catch {
      set({ user: null });
    }
  },
  updateCredits: (delta) => set((state) => ({
    user: state.user ? { ...state.user, credits: state.user.credits + delta } : null
  }))
}));
