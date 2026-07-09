"use client";

import { useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/agenda/event-types";
import type { AgendaTask } from "@/lib/agenda/types";

type AgendaTasksPanelProps = {
  tasks: AgendaTask[];
  onRefresh: () => void;
};

export function AgendaTasksPanel({ tasks, onRefresh }: AgendaTasksPanelProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<AgendaTask["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function createTask() {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await fetch("/api/agenda/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority, dueDate: dueDate || undefined }),
      });
      setTitle("");
      setDueDate("");
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function updateStatus(taskId: string, status: AgendaTask["status"]) {
    await fetch("/api/agenda/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", taskId, status }),
    });
    onRefresh();
  }

  async function convertToEvent(taskId: string) {
    await fetch("/api/agenda/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "convert", taskId }),
    });
    onRefresh();
  }

  const grouped = {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    done: tasks.filter((task) => task.status === "done"),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <FloraCard padding="lg" accent="lavender" className="lg:col-span-1">
        <h3 className="font-serif text-xl font-medium">Nouvelle tâche</h3>
        <div className="mt-4 grid gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de la tâche"
            className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as AgendaTask["priority"])}
            className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          >
            <option value="low">Priorité basse</option>
            <option value="medium">Priorité normale</option>
            <option value="high">Priorité haute</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
          <FloraButton onClick={() => void createTask()} disabled={isSaving}>
            Ajouter
          </FloraButton>
        </div>
      </FloraCard>

      <div className="grid gap-4 lg:col-span-2 md:grid-cols-3">
        {(["todo", "in_progress", "done"] as const).map((status) => (
          <FloraCard key={status} padding="md" accent="cream">
            <h4 className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</h4>
            <div className="mt-3 space-y-2">
              {grouped[status].length === 0 ? (
                <p className="text-xs font-light text-flora-text-subtle">Aucune tâche.</p>
              ) : (
                grouped[status].map((task) => (
                  <article key={task.id} className="rounded-2xl bg-white/45 p-3 text-sm">
                    <p className="font-medium">{task.title}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <FloraBadge accent="peach" size="sm">
                        {TASK_PRIORITY_LABELS[task.priority]}
                      </FloraBadge>
                      {task.dueDate ? (
                        <FloraBadge accent="lavender" size="sm">
                          {task.dueDate}
                        </FloraBadge>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {status !== "done" ? (
                        <FloraButton
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void updateStatus(
                              task.id,
                              status === "todo" ? "in_progress" : "done",
                            )
                          }
                        >
                          Avancer
                        </FloraButton>
                      ) : null}
                      <FloraButton
                        size="sm"
                        variant="secondary"
                        onClick={() => void convertToEvent(task.id)}
                      >
                        → Événement
                      </FloraButton>
                    </div>
                  </article>
                ))
              )}
            </div>
          </FloraCard>
        ))}
      </div>
    </div>
  );
}
