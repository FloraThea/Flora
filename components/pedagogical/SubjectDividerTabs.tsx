"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  sortSubjectTabs,
  subjectTabActiveClass,
  subjectTabBorderClass,
  subjectTabLabel,
} from "@/lib/pedagogical/subject-navigation";
import { SUBJECT_ALL, SUBJECT_NONE } from "@/lib/pedagogical/subjects";

type SubjectDividerTabsProps = {
  tabs: string[];
  activeTab: string;
  counts?: Record<string, number>;
  onChange: (tab: string) => void;
  tabOrder?: string[];
  onReorder?: (order: string[]) => void;
};

export function SubjectDividerTabs({
  tabs,
  activeTab,
  counts,
  onChange,
  tabOrder = [],
  onReorder,
}: SubjectDividerTabsProps) {
  const dragTab = useRef<string | null>(null);
  const orderedTabs = sortSubjectTabs(tabs, tabOrder).filter(
    (tab) => tab === SUBJECT_ALL || tab === SUBJECT_NONE || (counts?.[tab] ?? 0) > 0,
  );

  const handleDrop = useCallback(
    (targetTab: string) => {
      if (!onReorder || !dragTab.current) return;
      if (
        dragTab.current === targetTab ||
        dragTab.current === SUBJECT_ALL ||
        dragTab.current === SUBJECT_NONE ||
        targetTab === SUBJECT_ALL ||
        targetTab === SUBJECT_NONE
      ) {
        dragTab.current = null;
        return;
      }

      const subjects = orderedTabs.filter((tab) => tab !== SUBJECT_ALL && tab !== SUBJECT_NONE);
      const fromIndex = subjects.indexOf(dragTab.current);
      const toIndex = subjects.indexOf(targetTab);
      if (fromIndex < 0 || toIndex < 0) {
        dragTab.current = null;
        return;
      }

      const next = [...subjects];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onReorder(next);
      dragTab.current = null;
    },
    [onReorder, orderedTabs],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Matières"
        className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {orderedTabs.map((tab) => {
          const isActive = activeTab === tab;
          const draggable =
            Boolean(onReorder) && tab !== SUBJECT_ALL && tab !== SUBJECT_NONE;

          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              draggable={draggable}
              onDragStart={() => {
                dragTab.current = tab;
              }}
              onDragOver={(event) => {
                if (draggable) event.preventDefault();
              }}
              onDrop={() => handleDrop(tab)}
              onKeyDown={(event) => {
                const index = orderedTabs.indexOf(tab);
                if (event.key === "ArrowRight" && index < orderedTabs.length - 1) {
                  onChange(orderedTabs[index + 1]!);
                }
                if (event.key === "ArrowLeft" && index > 0) {
                  onChange(orderedTabs[index - 1]!);
                }
              }}
              onClick={() => onChange(tab)}
              className={cn(
                "shrink-0 rounded-t-2xl border border-b-0 border-white/70 px-4 py-2.5 text-sm font-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-light/60",
                "border-t-4",
                subjectTabBorderClass(tab),
                subjectTabActiveClass(tab, isActive),
              )}
            >
              {subjectTabLabel(tab)}
              {counts?.[tab] != null ? ` (${counts[tab]})` : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end">
        <Link
          href="/corbeille"
          className="rounded-2xl border border-white/70 bg-white/45 px-3 py-1.5 text-xs font-light text-flora-text-muted transition hover:bg-white/75"
        >
          Corbeille
        </Link>
      </div>
    </div>
  );
}

/** @deprecated Utiliser SubjectDividerTabs */
export { SubjectDividerTabs as SubjectTabBar };
