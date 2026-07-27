"use client";

type PreparationTabBarProps = {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onChange: (tabId: string) => void;
};

export function PreparationTabBar({ tabs, activeTab, onChange }: PreparationTabBarProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/50 pb-3">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-selected={isActive}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              isActive
                ? "bg-flora-rose/20 font-medium text-flora-text"
                : "bg-white/40 text-flora-text-muted hover:bg-white/70"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function PreparationFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
      {children}
    </span>
  );
}

export function PreparationTextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function PreparationTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function PreparationSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm ${props.className ?? ""}`}
    />
  );
}

export function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listToLines(values: string[]): string {
  return values.join("\n");
}
