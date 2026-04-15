import { create } from "zustand";

import type { User } from "#/types/auth";

type AuthState = {
  accessToken: string | null;
  user: User | null;
};

type AuthActions = {
  setAuth: (accessToken: string, user: User) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  accessToken: null,
  user: null,

  setAuth: (accessToken, user) => set({ accessToken, user }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
