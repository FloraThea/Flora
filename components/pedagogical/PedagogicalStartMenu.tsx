"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraBadge } from "@/components/ui/FloraBadge";

export type PedagogicalStartOption = {
  id: string;
  title: string;
  description: string;
  badge?: string;
  onSelect: () => void;
  disabled?: boolean;
};

type PedagogicalStartMenuProps = {
  moduleTitle: string;
  moduleSubtitle: string;
  options: PedagogicalStartOption[];
};

export function PedagogicalStartMenu({
  moduleTitle,
  moduleSubtitle,
  options,
}: PedagogicalStartMenuProps) {
  return (
    <FloraCard padding="lg" accent="lavender">
      <h2 className="font-serif text-2xl font-medium">{moduleTitle}</h2>
      <p className="mt-2 text-sm font-light text-flora-text-muted">{moduleSubtitle}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            onClick={option.onSelect}
            className="rounded-3xl border border-white/70 bg-white/50 p-5 text-left transition hover:border-white hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-lg font-medium">{option.title}</span>
              {option.badge ? <FloraBadge accent="cream">{option.badge}</FloraBadge> : null}
            </div>
            <p className="mt-2 text-sm font-light text-flora-text-muted">{option.description}</p>
          </button>
        ))}
      </div>
    </FloraCard>
  );
}

export function PedagogicalLinkBadge({
  mode,
  label,
}: {
  mode: "independent" | "linked" | "mixed";
  label?: string;
}) {
  const accent = mode === "independent" ? "peach" : mode === "mixed" ? "lavender" : "sage";
  const text =
    label ??
    (mode === "independent"
      ? "Indépendante"
      : mode === "mixed"
        ? "Mixte"
        : "Liée");

  return <FloraBadge accent={accent}>{text}</FloraBadge>;
}

export function PedagogicalRelationPanel({
  title,
  value,
  emptyLabel,
  onOpen,
  onChange,
  onDissociate,
}: {
  title: string;
  value: string | null;
  emptyLabel: string;
  onOpen?: () => void;
  onChange?: () => void;
  onDissociate?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/50 px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
        {title}
      </p>
      <p className="mt-1 text-sm font-light text-flora-text">
        {value ?? emptyLabel}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {value && onOpen ? (
          <FloraButton variant="secondary" onClick={onOpen}>
            Ouvrir
          </FloraButton>
        ) : null}
        {onChange ? (
          <FloraButton variant="secondary" onClick={onChange}>
            {value ? "Changer" : "Associer"}
          </FloraButton>
        ) : null}
        {value && onDissociate ? (
          <FloraButton variant="ghost" onClick={onDissociate}>
            Dissocier
          </FloraButton>
        ) : null}
      </div>
    </div>
  );
}
