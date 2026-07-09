"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/app/components/Sidebar";
import { layout } from "@/lib/theme";
import { cn } from "@/lib/cn";

type FloraAppShellProps = {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
};

export function FloraAppShell({ children, className, mainClassName }: FloraAppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn(layout.pageShell, className)}>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-sauge-sidebar/40 backdrop-blur-sm transition lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      <Sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-sauge-light/40 bg-sauge-bg/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-flora-text shadow-[var(--shadow-card)]"
            aria-label="Ouvrir le menu"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-serif text-xl font-medium text-flora-text">Flora</span>
        </div>

        <main className={cn(layout.main, mainClassName)}>{children}</main>
      </div>
    </div>
  );
}
