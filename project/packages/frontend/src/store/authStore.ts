import { create } from "zustand";
import type { PublicUser } from "@board-games/shared";
import { resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { translateServerMessage } from "../lib/i18n";

const API_URL = resolveApiBaseUrl();

interface AuthState {
  user: PublicUser | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  fetchMe: () => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ? translateServerMessage(data.message) : "Ошибка запроса.";
  } catch {
    return "Ошибка запроса.";
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  hydrated: false,

  fetchMe: async () => {
    set({ loading: true, error: null });
    try {
      let response = await fetch(`${API_URL}/api/auth/me`, {
        method: "GET",
        credentials: "include"
      });

      if (response.status === 401) {
        const refresh = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include"
        });
        if (refresh.ok) {
          response = await fetch(`${API_URL}/api/auth/me`, {
            method: "GET",
            credentials: "include"
          });
        }
      }

      if (!response.ok) {
        set({ user: null, loading: false, hydrated: true });
        return;
      }

      const data = (await response.json()) as { user: PublicUser };
      set({ user: data.user, loading: false, hydrated: true });
    } catch {
      set({ user: null, loading: false, hydrated: true });
    }
  },

  register: async (username, email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });

      if (!response.ok) {
        const message = await parseError(response);
        set({ loading: false, error: message });
        return false;
      }

      const data = (await response.json()) as { user: PublicUser };
      set({ user: data.user, loading: false, error: null, hydrated: true });
      return true;
    } catch {
      set({ loading: false, error: "Ошибка сети." });
      return false;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const message = await parseError(response);
        set({ loading: false, error: message });
        return false;
      }

      const data = (await response.json()) as { user: PublicUser };
      set({ user: data.user, loading: false, error: null, hydrated: true });
      return true;
    } catch {
      set({ loading: false, error: "Ошибка сети." });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    } finally {
      set({ user: null, loading: false, error: null, hydrated: true });
    }
  },

  clearError: () => set({ error: null })
}));
