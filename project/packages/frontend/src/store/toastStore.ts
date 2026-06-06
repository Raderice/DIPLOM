import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warn";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, type?: ToastType) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, type = "info") => {
    const id = String(++counter);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));

export const toast = {
  success: (msg: string) => useToastStore.getState().push(msg, "success"),
  error:   (msg: string) => useToastStore.getState().push(msg, "error"),
  warn:    (msg: string) => useToastStore.getState().push(msg, "warn"),
  info:    (msg: string) => useToastStore.getState().push(msg, "info"),
};
