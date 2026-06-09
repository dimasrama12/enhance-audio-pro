import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastEntry {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
  duration?: number; // ms; defaults to 3500
}

interface ToastState {
  toasts: ToastEntry[];
  addToast: (message: string, type: ToastType, action?: ToastAction, duration?: number) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type, action, duration = 3500) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, action, duration }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
