"use client";

import { cn } from "@/lib/cn";
import { FLORA_THEME_DEFINITIONS } from "@/lib/themes/definitions";
import type { FloraAppThemeId } from "@/lib/themes/types";

type ThemePickerProps = {
  value: FloraAppThemeId;
  onChange: (themeId: FloraAppThemeId) => void;
  className?: string;
};

export function ThemePicker({ value, onChange, className }: ThemePickerProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-3", className)}>
      {FLORA_THEME_DEFINITIONS.map((theme) => {
        const selected = value === theme.id;

        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onChange(theme.id)}
            className={cn(
              "group relative overflow-hidden rounded-[1.5rem] border-2 p-4 text-left transition-all duration-300",
              "hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]",
              selected
                ? "border-[var(--theme-accent)] bg-[var(--card-bg)] shadow-[var(--shadow-card)] ring-2 ring-[var(--theme-accent)]/30"
                : "border-[var(--card-border)] bg-[var(--card-bg)]/80",
            )}
            aria-pressed={selected}
          >
            <div
              className="mb-3 h-24 overflow-hidden rounded-2xl border border-white/40"
              style={{ background: theme.preview.background }}
            >
              <div className="flex h-full items-end gap-2 p-3">
                <span
                  className="h-10 flex-1 rounded-xl opacity-90"
                  style={{ background: theme.preview.accent }}
                />
                <span
                  className="h-14 w-12 rounded-xl opacity-90"
                  style={{ background: theme.preview.accent2 }}
                />
                <span
                  className="h-8 w-8 rounded-full opacity-80"
                  style={{ background: theme.preview.sidebar }}
                />
              </div>
            </div>

            <p className="text-base font-medium text-flora-text">
              {theme.emoji} {theme.name}
            </p>
            <p className="mt-1 text-xs font-light leading-relaxed text-flora-text-muted">
              {theme.description}
            </p>

            {selected ? (
              <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--theme-accent)] text-xs text-[var(--btn-primary-text)]">
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
