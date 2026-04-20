import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      updateUser: (updates) =>
        set((state) => ({
          user: { ...state.user, ...updates },
        })),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      // Getters
      isAdmin: () => get().user?.role === 'admin',
      isSeller: () => ['seller', 'admin'].includes(get().user?.role),
    }),
    {
      name: 'auth-storage',
      // Only persist user, NOT accessToken (token refreshed via cookie)
      partialize: (state) => ({ user: state.user }),
    }
  )
);