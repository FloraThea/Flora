/**
 * Flora Design System — référence visuelle vert sauge + cartes rose pâle.
 */

export const colors = {
  cream: {
    DEFAULT: "#faf7f2",
    warm: "#f5efe6",
    rose: "#fdecec",
  },
  rose: {
    DEFAULT: "#e8c4c4",
    soft: "#fdecec",
    text: "#b88989",
    card: "#fdecec",
    cardBorder: "rgba(232, 196, 196, 0.35)",
    button: "#f5dada",
  },
  sage: {
    DEFAULT: "#4a6752",
    strong: "#3d5a44",
    light: "#c5d4b8",
    muted: "#b8c9ab",
    bg: "#f4f7f2",
    bgDeep: "#e8efe4",
    sidebar: "#3d5a44",
    sidebarDeep: "#2d4739",
    sidebarActive: "#5e7a67",
    sidebarHover: "rgba(255, 255, 255, 0.08)",
    text: "#2d4739",
    textOnDark: "#f7f9f5",
    textMutedOnDark: "#c8d4c0",
  },
  beige: {
    DEFAULT: "#f0e8dc",
    light: "#f7f2ea",
  },
  lavender: {
    DEFAULT: "#c5b8d4",
    light: "#e8e0f0",
    text: "#9a8ab0",
  },
  peach: {
    DEFAULT: "#f5d4c4",
    light: "#fceee6",
    text: "#c49a88",
  },
  charcoal: {
    DEFAULT: "#2d4739",
    muted: "#4a5c42",
    subtle: "#6b7a65",
    faint: "#8a9685",
    label: "#a3ad9c",
  },
  thea: {
    core: "#fff4d6",
    glowWarm: "#ffd98a",
    glowGold: "#ffb347",
    halo: "rgba(255, 210, 120, 0.55)",
    ring: "rgba(255, 220, 150, 0.45)",
  },
  white: {
    card: "#ffffff",
  },
} as const;

export type FloraAccent = "cream" | "rose" | "sage" | "lavender" | "peach";

export const accents: FloraAccent[] = [
  "cream",
  "rose",
  "sage",
  "lavender",
  "peach",
];

export const shadows = {
  soft: "0 2px 16px rgba(45, 71, 57, 0.04)",
  card: "0 10px 30px rgba(0, 0, 0, 0.05)",
  hover: "0 12px 36px rgba(0, 0, 0, 0.07)",
  button: "0 4px 16px rgba(45, 71, 57, 0.18)",
  buttonSecondary: "0 2px 10px rgba(45, 71, 57, 0.06)",
  sidebar: "4px 0 24px rgba(45, 58, 40, 0.14)",
  active: "0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.08)",
  theaHalo: "0 0 40px rgba(255, 210, 120, 0.65), 0 0 80px rgba(255, 180, 80, 0.35)",
} as const;

export const radii = {
  md: "1rem",
  lg: "1.25rem",
  xl: "1.5rem",
  "2xl": "2rem",
  card: "1.75rem",
} as const;

export const motion = {
  fast: "150ms",
  base: "200ms",
  slow: "300ms",
  slower: "500ms",
  theaBreath: "4.5s",
  easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
} as const;

export const typography = {
  serif: "font-serif",
  sans: "font-sans",
} as const;

/** Cartes dashboard : rose pâle. Variante white pour panneaux larges. */
export const surfaces = {
  card: "rounded-[1.75rem] border border-rose-soft/50 bg-cream-rose shadow-[var(--shadow-card)]",
  cardWhite: "rounded-[1.75rem] border border-white/80 bg-white shadow-[var(--shadow-card)]",
  cardHover:
    "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauge/40 focus-visible:ring-offset-2 focus-visible:ring-offset-sauge-bg",
  page: "text-flora-text",
} as const;

export const layout = {
  sidebar: "flora-sidebar",
  pageShell: "watercolor-bg flex min-h-screen",
  main: "flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12 lg:py-10",
} as const;

export const buttons = {
  primary:
    "border border-sauge-strong/20 bg-sauge-strong text-flora-text-inverse shadow-[var(--shadow-button)] hover:bg-sauge active:scale-[0.98]",
  secondary:
    "border border-rose-soft/80 bg-rose-button text-flora-text shadow-[var(--shadow-button-secondary)] hover:bg-rose-soft active:scale-[0.98]",
  ghost:
    "border border-transparent bg-transparent text-flora-text-muted hover:bg-sauge-light/25 hover:text-flora-text",
  outline:
    "border border-sauge/30 bg-white text-flora-text hover:bg-sauge-bg",
} as const;

export const accentClasses: Record<
  FloraAccent,
  {
    bg: string;
    bgMuted: string;
    border: string;
    text: string;
    dot: string;
    badge: string;
    progress: string;
    cardAccent: string;
    iconCircle: string;
  }
> = {
  cream: {
    bg: "bg-beige-light",
    bgMuted: "bg-beige-light/70",
    border: "border-beige/70",
    text: "text-flora-text-muted",
    dot: "bg-beige",
    badge: "bg-beige-light/80 text-flora-text-muted",
    progress: "bg-beige",
    cardAccent: "border-l-beige",
    iconCircle: "bg-beige-light text-flora-text-muted",
  },
  rose: {
    bg: "bg-rose-soft/50",
    bgMuted: "bg-rose-button/80",
    border: "border-rose-soft/60",
    text: "text-rose-text",
    dot: "bg-rose-poudre",
    badge: "bg-rose-soft/60 text-rose-text",
    progress: "bg-rose-poudre",
    cardAccent: "border-l-rose-poudre/50",
    iconCircle: "bg-rose-button text-rose-text",
  },
  sage: {
    bg: "bg-sauge-light/35",
    bgMuted: "bg-sauge-light/25",
    border: "border-sauge-light/50",
    text: "text-sauge-strong",
    dot: "bg-sauge",
    badge: "bg-sauge-light/50 text-sauge-strong",
    progress: "bg-sauge",
    cardAccent: "border-l-sauge/40",
    iconCircle: "bg-sauge-light/50 text-sauge-strong",
  },
  lavender: {
    bg: "bg-lavande-light/50",
    bgMuted: "bg-lavande-light/35",
    border: "border-lavande-light/60",
    text: "text-lavande-text",
    dot: "bg-lavande",
    badge: "bg-lavande-light/60 text-lavande-text",
    progress: "bg-lavande",
    cardAccent: "border-l-lavande/40",
    iconCircle: "bg-lavande-light/60 text-lavande-text",
  },
  peach: {
    bg: "bg-peche-light/60",
    bgMuted: "bg-peche-light/40",
    border: "border-peche/40",
    text: "text-peche-text",
    dot: "bg-peche",
    badge: "bg-peche/30 text-peche-text",
    progress: "bg-peche",
    cardAccent: "border-l-peche/50",
    iconCircle: "bg-peche-light/70 text-peche-text",
  },
};

export const theme = {
  colors,
  accents,
  shadows,
  radii,
  motion,
  typography,
  accentClasses,
  surfaces,
  layout,
  buttons,
} as const;

export type Theme = typeof theme;
