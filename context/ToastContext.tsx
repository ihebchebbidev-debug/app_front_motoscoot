import React, { createContext, useContext, useMemo } from 'react';

/**
 * Site notifications. The API is unchanged (`useToast().addToast(message,
 * type, duration)`, 38 callers). They are drawn by Sonner, which is loaded
 * only when the first notification is asked for (≈10 KB gzip kept out of every
 * first page load, like socket.io and Clerk): requests wait in a queue until
 * components/ui/SonnerToaster.tsx is mounted and registers itself.
 */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type PendingToast = { message: string; type: ToastType; duration: number };
type Renderer = { show: (t: PendingToast) => void; dismiss: (id?: string) => void };

let renderer: Renderer | null = null;
const queue: PendingToast[] = [];
const requestListeners = new Set<() => void>();

/** Wiring between the queue and the lazy Sonner toaster (ToastContainer). */
export const toastBus = {
  /** Called by SonnerToaster once Sonner's <Toaster> is mounted. */
  register(r: Renderer) {
    renderer = r;
    queue.splice(0).forEach((t) => r.show(t));
    return () => { if (renderer === r) renderer = null; };
  },
  /** ToastContainer listens to load Sonner on the first request. */
  onRequest(listener: () => void) {
    requestListeners.add(listener);
    return () => { requestListeners.delete(listener); };
  },
  get hasPending() { return queue.length > 0; },
};

const addToast = (message: string, type: ToastType = 'success', duration = 4000) => {
  const t = { message, type, duration };
  if (renderer) renderer.show(t);
  else {
    queue.push(t);
    requestListeners.forEach((l) => l());
  }
};

const removeToast = (id: string) => {
  renderer?.dismiss(id);
};

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Stable value: a new toast no longer re-renders every consumer.
  const value = useMemo(() => ({ addToast, removeToast }), []);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
