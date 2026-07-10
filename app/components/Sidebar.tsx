"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

function NavIcon({ children, active }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
        active ? "flora-sidebar-icon-active" : "flora-sidebar-icon",
      )}
    >
      {children}
    </span>
  );
}

function LeafLogo() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/12">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden>
        <path
          d="M12 3c-4 6-6 9-6 13a6 6 0 0 0 12 0c0-4-2-7-6-13Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M12 16v5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const navItems: NavItem[] = [
  {
    label: "Accueil",
    href: "/accueil",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path
          d="M3 8.5 10 3l7 5.5V16a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 16V8.5Z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Bibliothèque",
    href: "/bibliotheque",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path
          d="M4 4h8l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    ),
  },
  {
    label: "Planificateur annuel",
    href: "/planificateur-annuel",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 7h14M7 3v14M11 3v14" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Emploi du temps",
    href: "/emploi-du-temps",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 3v3M13 3v3M3 9h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Programmations",
    href: "/programmation",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M4 4h12v12H4V4Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 8h12M8 4v12" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Progressions",
    href: "/progression",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M3 14l4-4 3 3 7-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Séquences",
    href: "/sequences",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 8h14M7 4v12" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Séances",
    href: "/seances",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M4 5h12M4 10h8M4 15h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Agenda",
    href: "/agenda",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 9h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Cahier journal",
    href: "/cahier-journal",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path
          d="M5 3h8l4 4v11H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    ),
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/accueil") return pathname === "/accueil";
  if (href === "/agenda") return pathname === "/agenda" || pathname === "/";
  return pathname.startsWith(href.split("?")[0]);
}

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("flora-sidebar flex w-72 shrink-0 flex-col px-4 py-7 lg:px-5 lg:py-8", className)}>
      <div className="mb-8 px-2">
        <Link href="/accueil" className="flex items-center gap-3" onClick={onNavigate}>
          <LeafLogo />
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-flora-text-inverse">
              Flora
            </h1>
            <p className="text-xs font-light text-white/65">Mon assistant pédagogique</p>
          </div>
        </Link>
      </div>

      <Link
        href="/profil"
        onClick={onNavigate}
        className={cn(
          "mb-6 flex items-center gap-3 rounded-2xl px-3 py-2.5 transition",
          pathname.startsWith("/profil") ? "bg-white/12" : "hover:bg-white/8",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-medium text-white">
          CM
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-normal text-white">Profil enseignant</p>
          <p className="truncate text-xs font-light text-white/60">Paramètres et préférences</p>
        </div>
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-white/50" aria-hidden>
          <path d="M7 8l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </Link>

      <nav className="flex flex-1 flex-col overflow-y-auto">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-light",
                    active ? "flora-sidebar-link-active" : "flora-sidebar-link",
                  )}
                >
                  <NavIcon active={active}>{item.icon}</NavIcon>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {process.env.NODE_ENV === "development" ? (
        <div className="mt-6 flex flex-col gap-1 border-t border-white/10 pt-4">
          <Link
            href="/administration"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-light",
              pathname.startsWith("/administration") ? "flora-sidebar-link-active" : "flora-sidebar-link",
            )}
          >
            <NavIcon active={pathname.startsWith("/administration")}>
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
                <path
                  d="M7 4h6M5 8h10M7 12h6M9 16h2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </NavIcon>
            Administration
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
