"use client";

import { TheaGlow } from "@/components/ui/TheaGlow";
import { cn } from "@/lib/cn";
import { useTheaChat } from "./thea-chat-context";

type TheaChatFabProps = {
  className?: string;
};

export function TheaChatFab({ className }: TheaChatFabProps) {
  const { openChat, isOpen } = useTheaChat();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => openChat("chat")}
      className={cn(
        "fixed bottom-6 right-6 z-30 flex items-center gap-3 rounded-full border border-white/60 bg-[var(--flora-surface)] px-4 py-2.5 shadow-[var(--shadow-card)] transition hover:scale-[1.02] active:scale-[0.98]",
        "max-md:bottom-[max(1.5rem,env(safe-area-inset-bottom))] max-md:right-4",
        className,
      )}
      aria-label="Ouvrir la discussion avec Théa"
    >
      <TheaGlow size="sm" pulse showFace={false} />
      <span className="text-sm font-light text-flora-text">Théa</span>
    </button>
  );
}
