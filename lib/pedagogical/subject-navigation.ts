import type { FloraAccent } from "@/lib/theme";
import {
  normalizeMatiere,
  normalizeSousMatiere,
  SUBJECT_ALL,
  SUBJECT_NONE,
  subSubjectsForMatiere,
} from "./subjects";

export type PedagogicalModuleKey = "programmation" | "progression" | "sequence" | "seance";

export const SUB_SUBJECT_ALL = "__sub_all__";

export const GLOBAL_ACTIVE_SUBJECT_KEY = "flora:global-active-subject";

export const SUBJECT_DISPLAY_ORDER = [
  "Français",
  "Mathématiques",
  "Histoire",
  "Géographie",
  "EMC",
  "Sciences",
  "Anglais",
  "Arts plastiques",
  "Éducation musicale",
  "EPS",
] as const;

const SUBJECT_ACCENT_MAP: Record<string, FloraAccent> = {
  Français: "lavender",
  Mathématiques: "sage",
  Histoire: "peach",
  Géographie: "cream",
  EMC: "rose",
  Sciences: "sage",
  Anglais: "lavender",
  "Arts plastiques": "peach",
  "Éducation musicale": "cream",
  EPS: "rose",
  [SUBJECT_NONE]: "cream",
  [SUBJECT_ALL]: "cream",
};

const ACCENT_BORDER: Record<FloraAccent, string> = {
  lavender: "border-t-[#c5b8d4]",
  sage: "border-t-[#4a6752]",
  peach: "border-t-[#f5d4c4]",
  cream: "border-t-[#f0e8dc]",
  rose: "border-t-[#e8c4c4]",
};

const ACCENT_ACTIVE_BG: Record<FloraAccent, string> = {
  lavender: "bg-lavender-light/55",
  sage: "bg-sage-bg/80",
  peach: "bg-peach-light/70",
  cream: "bg-beige-light/80",
  rose: "bg-rose-soft/50",
};

export type SubjectNavItem = {
  matiere?: string | null;
  sous_matiere?: string | null;
  sousMatiere?: string | null;
};

export function moduleSubjectTabKey(module: PedagogicalModuleKey): string {
  return `flora:subject-nav:${module}:tab`;
}

export function moduleSubSubjectTabKey(module: PedagogicalModuleKey): string {
  return `flora:subject-nav:${module}:sub`;
}

export function moduleTabOrderKey(module: PedagogicalModuleKey): string {
  return `flora:subject-nav:${module}:order`;
}

export function readStoredSubjectTab(module: PedagogicalModuleKey): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(moduleSubjectTabKey(module));
}

export function persistSubjectTab(module: PedagogicalModuleKey, tab: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(moduleSubjectTabKey(module), tab);
  if (tab !== SUBJECT_ALL && tab !== SUBJECT_NONE) {
    localStorage.setItem(GLOBAL_ACTIVE_SUBJECT_KEY, tab);
  }
}

export function readStoredSubSubjectTab(module: PedagogicalModuleKey): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(moduleSubSubjectTabKey(module));
}

export function persistSubSubjectTab(module: PedagogicalModuleKey, tab: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(moduleSubSubjectTabKey(module), tab);
}

export function readGlobalActiveSubject(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GLOBAL_ACTIVE_SUBJECT_KEY);
}

export function readStoredTabOrder(module: PedagogicalModuleKey): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(moduleTabOrderKey(module));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function persistTabOrder(module: PedagogicalModuleKey, order: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(moduleTabOrderKey(module), JSON.stringify(order));
}

export function resolveInitialSubjectTab(
  module: PedagogicalModuleKey,
  availableTabs: string[],
): string {
  const stored = readStoredSubjectTab(module);
  if (stored && availableTabs.includes(stored)) return stored;

  const globalSubject = readGlobalActiveSubject();
  if (globalSubject && availableTabs.includes(globalSubject)) return globalSubject;

  return SUBJECT_ALL;
}

export function itemMatiere(item: SubjectNavItem): string {
  return normalizeMatiere(item.matiere);
}

export function itemSousMatiere(item: SubjectNavItem, matiere: string): string {
  const raw = item.sousMatiere ?? item.sous_matiere ?? "";
  return normalizeSousMatiere(raw, matiere);
}

export function subjectTabId(matiere: string): string {
  return matiere || SUBJECT_NONE;
}

export function buildDynamicSubjectTabs(items: SubjectNavItem[]): string[] {
  const present = new Set<string>();
  for (const item of items) {
    present.add(subjectTabId(itemMatiere(item)));
  }

  const tabs: string[] = [SUBJECT_ALL];
  if (present.has(SUBJECT_NONE)) tabs.push(SUBJECT_NONE);

  const orderedSubjects = sortSubjectKeys([...present].filter((key) => key !== SUBJECT_NONE));
  tabs.push(...orderedSubjects);
  return tabs;
}

export function sortSubjectKeys(keys: string[], customOrder: string[] = []): string[] {
  const orderIndex = new Map<string, number>();
  customOrder.forEach((key, index) => orderIndex.set(key, index));
  SUBJECT_DISPLAY_ORDER.forEach((subject, index) => {
    if (!orderIndex.has(subject)) orderIndex.set(subject, index);
  });

  return [...keys].sort((a, b) => {
    const indexA = orderIndex.get(a) ?? 999;
    const indexB = orderIndex.get(b) ?? 999;
    if (indexA !== indexB) return indexA - indexB;
    return a.localeCompare(b, "fr");
  });
}

export function sortSubjectTabs(tabs: string[], customOrder: string[] = []): string[] {
  const pinned = tabs.filter((tab) => tab === SUBJECT_ALL || tab === SUBJECT_NONE);
  const subjects = tabs.filter((tab) => tab !== SUBJECT_ALL && tab !== SUBJECT_NONE);
  return [...pinned.filter((tab) => tab === SUBJECT_ALL), ...sortSubjectKeys(subjects, customOrder), ...pinned.filter((tab) => tab === SUBJECT_NONE)];
}

export function buildSubjectTabCounts(items: SubjectNavItem[]): Record<string, number> {
  const counts: Record<string, number> = { [SUBJECT_ALL]: items.length };

  for (const item of items) {
    const key = subjectTabId(itemMatiere(item));
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
}

export function matchesSubjectTab(item: SubjectNavItem, activeTab: string): boolean {
  if (activeTab === SUBJECT_ALL) return true;
  const matiere = itemMatiere(item);
  if (activeTab === SUBJECT_NONE) return !matiere;
  return matiere === activeTab;
}

export function buildDynamicSubSubjectTabs(
  items: SubjectNavItem[],
  activeSubjectTab: string,
): string[] {
  if (activeSubjectTab === SUBJECT_ALL || activeSubjectTab === SUBJECT_NONE) {
    return [SUB_SUBJECT_ALL];
  }

  const present = new Set<string>();
  for (const item of items) {
    if (!matchesSubjectTab(item, activeSubjectTab)) continue;
    const sousMatiere = itemSousMatiere(item, activeSubjectTab);
    if (sousMatiere) present.add(sousMatiere);
  }

  if (present.size === 0) return [SUB_SUBJECT_ALL];

  const canonical = subSubjectsForMatiere(activeSubjectTab);
  const ordered = [
    SUB_SUBJECT_ALL,
    ...canonical.filter((label) => present.has(label)),
    ...[...present]
      .filter((label) => !canonical.includes(label))
      .sort((a, b) => a.localeCompare(b, "fr")),
  ];

  return ordered;
}

export function matchesSubSubjectTab(
  item: SubjectNavItem,
  activeSubjectTab: string,
  activeSubSubjectTab: string,
): boolean {
  if (!matchesSubjectTab(item, activeSubjectTab)) return false;
  if (activeSubSubjectTab === SUB_SUBJECT_ALL) return true;
  return itemSousMatiere(item, activeSubjectTab) === activeSubSubjectTab;
}

export function subjectAccentForTab(tab: string): FloraAccent {
  if (tab === SUBJECT_ALL || tab === SUBJECT_NONE) return "cream";
  return SUBJECT_ACCENT_MAP[tab] ?? "lavender";
}

export function subjectTabBorderClass(tab: string): string {
  return ACCENT_BORDER[subjectAccentForTab(tab)];
}

export function subjectTabActiveClass(tab: string, isActive: boolean): string {
  if (!isActive) return "bg-white/50 text-flora-text-muted hover:bg-white/75";
  return `${ACCENT_ACTIVE_BG[subjectAccentForTab(tab)]} text-flora-text shadow-sm`;
}

export function subjectTabLabel(tab: string): string {
  if (tab === SUBJECT_ALL) return "Tous";
  if (tab === SUBJECT_NONE) return "Sans matière";
  return tab;
}

export function subSubjectTabLabel(tab: string): string {
  if (tab === SUB_SUBJECT_ALL) return "Tous";
  return tab;
}

export function resolveSourceFileName(item: {
  source_file_name?: string | null;
  sourceFileName?: string | null;
  metadata?: unknown;
  title?: string;
}): string {
  const direct = String(item.source_file_name ?? item.sourceFileName ?? "").trim();
  if (direct) return direct;

  if (item.metadata && typeof item.metadata === "object") {
    const fromMeta = String((item.metadata as Record<string, unknown>).source_file_name ?? "").trim();
    if (fromMeta) return fromMeta;
  }

  return String(item.title ?? "").trim();
}
