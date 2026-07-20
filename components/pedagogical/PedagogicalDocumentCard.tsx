"use client";

import { useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { KNOWN_SUBJECTS, normalizeMatiere, subSubjectsForMatiere } from "@/lib/pedagogical/subjects";
import { resolveSourceFileName } from "@/lib/pedagogical/subject-navigation";

export type PedagogicalDocumentListItem = {
  id: string;
  title: string;
  matiere?: string | null;
  sous_matiere?: string | null;
  sousMatiere?: string | null;
  niveau?: string | null;
  periode?: string | null;
  school_year?: string | null;
  status?: string | null;
  created_at?: string | null;
  source_file_name?: string | null;
  sourceFileName?: string | null;
  metadata?: unknown;
  linkCount?: number;
  documentType?: string;
};

type PedagogicalDocumentCardProps = {
  item: PedagogicalDocumentListItem;
  selected?: boolean;
  onOpen: () => void;
  onTrash?: () => void;
  onMoveSubject?: (matiere: string, sousMatiere: string) => void;
};

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR");
}

export function PedagogicalDocumentCard({
  item,
  selected = false,
  onOpen,
  onTrash,
  onMoveSubject,
}: PedagogicalDocumentCardProps) {
  const [showMove, setShowMove] = useState(false);
  const [moveMatiere, setMoveMatiere] = useState(normalizeMatiere(item.matiere));
  const [moveSousMatiere, setMoveSousMatiere] = useState(
    String(item.sousMatiere ?? item.sous_matiere ?? ""),
  );

  const sourceName = resolveSourceFileName(item);
  const displayTitle = sourceName || item.title;
  const subSubjects = subSubjectsForMatiere(moveMatiere);

  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        selected
          ? "border-lavender-light/70 bg-lavender-light/20"
          : "border-white/70 bg-white/55 hover:bg-white/75"
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium text-flora-text">{displayTitle}</p>
          {sourceName && sourceName !== item.title ? (
            <p className="mt-1 truncate text-xs font-light text-flora-text-muted">{item.title}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.documentType ? <FloraBadge accent="cream">{item.documentType}</FloraBadge> : null}
            {item.matiere ? <FloraBadge accent="lavender">{item.matiere}</FloraBadge> : null}
            {(item.sousMatiere ?? item.sous_matiere) ? (
              <FloraBadge accent="sage">{item.sousMatiere ?? item.sous_matiere}</FloraBadge>
            ) : null}
            {item.status ? <FloraBadge accent="peach">{item.status}</FloraBadge> : null}
          </div>
          <p className="mt-2 text-xs font-light text-flora-text-muted">
            {[item.niveau, item.periode, item.school_year].filter(Boolean).join(" · ")}
            {item.created_at ? ` · importé le ${formatDate(item.created_at)}` : ""}
            {item.linkCount != null && item.linkCount > 0 ? ` · ${item.linkCount} lien(s)` : ""}
          </p>
        </button>

        <div className="flex flex-wrap gap-2">
          <FloraButton size="sm" onClick={onOpen}>
            Consulter
          </FloraButton>
          {onMoveSubject ? (
            <FloraButton size="sm" variant="secondary" onClick={() => setShowMove((value) => !value)}>
              Déplacer
            </FloraButton>
          ) : null}
          {onTrash ? (
            <FloraButton size="sm" variant="ghost" onClick={onTrash}>
              Corbeille
            </FloraButton>
          ) : null}
        </div>
      </div>

      {showMove && onMoveSubject ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/70 bg-white/50 p-3 md:grid-cols-[1fr_1fr_auto]">
          <select
            value={moveMatiere}
            onChange={(event) => {
              setMoveMatiere(event.target.value);
              setMoveSousMatiere("");
            }}
            className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm"
          >
            <option value="">Sans matière</option>
            {KNOWN_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
          {subSubjects.length > 0 ? (
            <select
              value={moveSousMatiere}
              onChange={(event) => setMoveSousMatiere(event.target.value)}
              className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm"
            >
              <option value="">Sans sous-matière</option>
              {subSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={moveSousMatiere}
              onChange={(event) => setMoveSousMatiere(event.target.value)}
              placeholder="Sous-matière"
              className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm"
            />
          )}
          <FloraButton
            size="sm"
            onClick={() => {
              onMoveSubject(moveMatiere, moveSousMatiere);
              setShowMove(false);
            }}
          >
            Enregistrer
          </FloraButton>
        </div>
      ) : null}
    </article>
  );
}
