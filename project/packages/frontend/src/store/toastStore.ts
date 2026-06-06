import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warn";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 5;
const TOAST_DURATION_MS = 4000;
const EXIT_DURATION_MS = 300;

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (message, type = "info") => {
    const id = String(++counter);

    set((s) => {
      const next = [...s.toasts, { id, message, type }];
      return { toasts: next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next };
    });

    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.map((t) => t.id === id ? { ...t, exiting: true } : t) }));
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, EXIT_DURATION_MS);
    }, TOAST_DURATION_MS);
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.map((t) => t.id === id ? { ...t, exiting: true } : t) }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, EXIT_DURATION_MS);
  }
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().push(msg, "success"),
  error:   (msg: string) => useToastStore.getState().push(msg, "error"),
  warn:    (msg: string) => useToastStore.getState().push(msg, "warn"),
  info:    (msg: string) => useToastStore.getState().push(msg, "info"),
};
