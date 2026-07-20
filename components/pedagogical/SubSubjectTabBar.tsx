"use client";

import { cn } from "@/lib/cn";
import { subSubjectTabLabel, SUB_SUBJECT_ALL } from "@/lib/pedagogical/subject-navigation";

type SubSubjectTabBarProps = {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
};

export function SubSubjectTabBar({ tabs, activeTab, onChange }: SubSubjectTabBarProps) {
  if (tabs.length <= 1 && tabs[0] === SUB_SUBJECT_ALL) return null;

  return (
    <div
      role="tablist"
      aria-label="Sous-matières"
      className="flex flex-wrap gap-2"
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-light transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-light/60",
            activeTab === tab
              ? "bg-white/80 text-flora-text"
              : "bg-white/40 text-flora-text-muted hover:bg-white/65",
          )}
        >
          {subSubjectTabLabel(tab)}
        </button>
      ))}
    </div>
  );
}
