"use client";

import { useCallback, useEffect, useRef } from "react";
import { FloraToastStack, useFloraToasts } from "@/components/ui/FloraToast";
import type { AgendaReminder } from "@/lib/agenda/types";

type AgendaReminderToastsProps = {
  initialDue?: AgendaReminder[];
  pollIntervalMs?: number;
};

export function AgendaReminderToasts({
  initialDue = [],
  pollIntervalMs = 30_000,
}: AgendaReminderToastsProps) {
  const { toasts, pushToast, dismissToast } = useFloraToasts();
  const shownIds = useRef(new Set<string>());

  const showReminder = useCallback(
    async (reminder: AgendaReminder) => {
      if (shownIds.current.has(reminder.id)) return;
      shownIds.current.add(reminder.id);

      pushToast({
        id: reminder.id,
        message: reminder.message,
        variant: "reminder",
        durationMs: 10_000,
      });

      await fetch("/api/agenda/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sent", reminderId: reminder.id }),
      });
    },
    [pushToast],
  );

  useEffect(() => {
    for (const reminder of initialDue) {
      void showReminder(reminder);
    }
  }, [initialDue, showReminder]);

  useEffect(() => {
    async function poll() {
      try {
        const response = await fetch("/api/agenda/reminders");
        const data = (await response.json()) as { reminders?: AgendaReminder[] };
        for (const reminder of data.reminders ?? []) {
          await showReminder(reminder);
        }
      } catch {
        // Polling silencieux
      }
    }

    const interval = window.setInterval(() => void poll(), pollIntervalMs);
    return () => window.clearInterval(interval);
  }, [pollIntervalMs, showReminder]);

  return <FloraToastStack toasts={toasts} onDismiss={dismissToast} />;
}
