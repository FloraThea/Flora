"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type FloraToastItem = {
  id: string;
  message: string;
  variant?: "info" | "success" | "error" | "reminder";
  durationMs?: number;
};

type FloraToastStackProps = {
  toasts: FloraToastItem[];
  onDismiss: (id: string) => void;
};

export function FloraToastStack({ toasts, onDismiss }: FloraToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-50 flex max-w-sm flex-col gap-3"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <FloraToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function FloraToast({
  toast,
  onDismiss,
}: {
  toast: FloraToastItem;
  onDismiss: (id: string) => void;
}) {
  const duration = toast.durationMs ?? (toast.variant === "error" ? 10000 : 8000);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, onDismiss, toast.id]);

  const variantStyles = {
    reminder: "bg-lavande-light/90 text-flora-text border-lavande-light/60",
    success: "bg-sauge-bg/95 text-flora-text border-sauge-light/60",
    error: "bg-cream-rose/95 text-flora-text border-rose-poudre/50",
    info: "bg-cream-rose/95 text-flora-text border-rose-soft/50",
  } as const;

  const variantIcon = {
    reminder: "🔔",
    success: "✓",
    error: "✕",
    info: "ℹ️",
  } as const;

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-2xl border border-white/70 px-4 py-3 shadow-lg backdrop-blur-sm transition-transform",
        variantStyles[toast.variant ?? "info"],
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base" aria-hidden>
          {variantIcon[toast.variant ?? "info"]}
        </span>
        <p className="flex-1 text-sm font-light leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-xs text-flora-text-subtle hover:text-flora-text"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function useFloraToasts() {
  const [toasts, setToasts] = useState<FloraToastItem[]>([]);

  const pushToast = useCallback((item: Omit<FloraToastItem, "id"> & { id?: string }) => {
    const id = item.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => {
      if (current.some((toast) => toast.id === id)) return current;
      return [...current, { ...item, id }];
    });
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, pushToast, dismissToast };
}
