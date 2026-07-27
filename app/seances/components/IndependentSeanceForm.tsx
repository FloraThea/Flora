"use client";

import { mapSeanceFormToCreateInput } from "@/lib/pedagogical/preparation/form-mappers";
import type { SeancePayload } from "@/lib/seances/types";
import { SeancePreparationForm } from "@/components/pedagogical/preparation/SeancePreparationForm";

type IndependentSeanceFormProps = {
  onCreated: (payload: SeancePayload) => void;
  onCancel: () => void;
};

export function IndependentSeanceForm({ onCreated, onCancel }: IndependentSeanceFormProps) {
  return (
    <SeancePreparationForm
      onCancel={onCancel}
      onSubmit={async (values) => {
        const body = mapSeanceFormToCreateInput(values);
        const response = await fetch("/api/seances/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json()) as SeancePayload & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Impossible de créer la séance.");
        }
        onCreated(data);
      }}
    />
  );
}
