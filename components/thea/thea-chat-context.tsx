"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TheaChatMode } from "@/lib/thea/chat/types";

type TheaChatContextValue = {
  isOpen: boolean;
  initialMode: TheaChatMode;
  openChat: (mode?: TheaChatMode) => void;
  closeChat: () => void;
};

const TheaChatContext = createContext<TheaChatContextValue | null>(null);

export function TheaChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<TheaChatMode>("chat");

  const openChat = useCallback((mode: TheaChatMode = "chat") => {
    setInitialMode(mode);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({ isOpen, initialMode, openChat, closeChat }),
    [closeChat, initialMode, isOpen, openChat],
  );

  return <TheaChatContext.Provider value={value}>{children}</TheaChatContext.Provider>;
}

export function useTheaChat(): TheaChatContextValue {
  const context = useContext(TheaChatContext);
  if (!context) {
    throw new Error("useTheaChat must be used within TheaChatProvider");
  }
  return context;
}
