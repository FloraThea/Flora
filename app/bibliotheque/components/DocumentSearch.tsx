import { colors } from "@/lib/theme";

type DocumentSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function DocumentSearch({ value, onChange }: DocumentSearchProps) {
  return (
    <label className="block">
      <span
        className="mb-2 block text-[11px] font-medium tracking-[0.12em] uppercase"
        style={{ color: colors.charcoal.label }}
      >
        Recherche
      </span>
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2"
          style={{ color: colors.charcoal.faint }}
          aria-hidden
        >
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Rechercher par titre, résumé, tags, compétences, matière, méthode…"
          className="w-full rounded-2xl border border-white/70 bg-white/60 py-3 pr-4 pl-11 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
        />
      </div>
    </label>
  );
}
