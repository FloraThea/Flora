"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";

type AgendaErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function AgendaErrorState({ message, onRetry }: AgendaErrorStateProps) {
  return (
    <FloraCard padding="lg" accent="rose">
      <p className="text-sm font-light text-flora-text">{message}</p>
      <FloraButton accent="sage" className="mt-4" onClick={onRetry}>
        Réessayer
      </FloraButton>
    </FloraCard>
  );
}

export function AgendaSkeleton() {
  return (
    <FloraCard padding="lg" accent="cream">
      <p className="text-sm font-light text-flora-text-subtle">Chargement de l&apos;agenda…</p>
    </FloraCard>
  );
}

export function EmptyAgendaState() {
  return (
    <FloraCard padding="lg" accent="lavender">
      <p className="font-serif text-xl font-medium">Aucun événement pour le moment</p>
      <p className="mt-2 text-sm font-light text-flora-text-subtle">
        Votre agenda est prêt. Ajoutez un événement ou laissez les modules pédagogiques alimenter
        votre calendrier.
      </p>
    </FloraCard>
  );
}
