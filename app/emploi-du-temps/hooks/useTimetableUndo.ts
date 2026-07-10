"use client";

import { useCallback, useRef, useState } from "react";
import type { TimetablePayload } from "@/lib/timetable/types";

const MAX_HISTORY = 20;

export function useTimetableUndo() {
  const undoStack = useRef<TimetablePayload[]>([]);
  const redoStack = useRef<TimetablePayload[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const pushSnapshot = useCallback(
    (snapshot: TimetablePayload) => {
      undoStack.current = [...undoStack.current.slice(-(MAX_HISTORY - 1)), snapshot];
      redoStack.current = [];
      syncFlags();
    },
    [syncFlags],
  );

  const peekUndo = useCallback((): TimetablePayload | null => {
    const stack = undoStack.current;
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }, []);

  const peekRedo = useCallback((): TimetablePayload | null => {
    const stack = redoStack.current;
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }, []);

  const commitUndo = useCallback(
    (current: TimetablePayload) => {
      const previous = undoStack.current.pop();
      if (!previous) return null;
      redoStack.current = [...redoStack.current, current];
      syncFlags();
      return previous;
    },
    [syncFlags],
  );

  const commitRedo = useCallback(
    (current: TimetablePayload) => {
      const next = redoStack.current.pop();
      if (!next) return null;
      undoStack.current = [...undoStack.current, current];
      syncFlags();
      return next;
    },
    [syncFlags],
  );

  const resetHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    syncFlags();
  }, [syncFlags]);

  return {
    canUndo,
    canRedo,
    pushSnapshot,
    peekUndo,
    peekRedo,
    commitUndo,
    commitRedo,
    resetHistory,
  };
}
