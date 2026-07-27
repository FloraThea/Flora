"use client";

import { mapSequenceFormToCreateInput } from "@/lib/pedagogical/preparation/form-mappers";
import type { SequencePayload } from "@/lib/sequences/types";
import { SequencePreparationForm } from "@/components/pedagogical/preparation/SequencePreparationForm";

type IndependentSequenceFormProps = {
  onCreated: (payload: SequencePayload) => void;
  onCancel: () => void;
};

export function IndependentSequenceForm({ onCreated, onCancel }: IndependentSequenceFormProps) {
  return (
    <SequencePreparationForm
      onCancel={onCancel}
      onSubmit={async (values) => {
        const body = mapSequenceFormToCreateInput(values);
        const response = await fetch("/api/sequences/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = (await response.json()) as SequencePayload & { error?: string };
        if (!response.ok) {
          throw new Error(data.error || "Impossible de créer la séquence.");
        }
        onCreated(data);
      }}
    />
  );
}
