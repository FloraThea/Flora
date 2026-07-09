export function DashboardHeader() {
  return (
    <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-serif text-4xl font-medium tracking-tight text-flora-text">
          Bonjour Camille 🌸
        </h2>
        <p className="mt-2 text-base font-light text-flora-text-subtle">
          Jeudi 25 juin 2026
        </p>
        <p className="mt-1 text-sm font-light text-flora-text-subtle">
          Période 1 · Semaine 2 · CE1-CE2
        </p>
      </div>

      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-2.5 self-start rounded-2xl border border-sauge-light/70 bg-white/60 px-5 py-3 text-sm font-normal text-flora-text shadow-[0_2px_16px_rgba(0,0,0,0.03)] backdrop-blur-sm transition-all duration-200 hover:border-sauge/40 hover:bg-white/80 hover:shadow-[0_4px_20px_rgba(156,175,136,0.12)]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sauge-light/50">
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-sauge" aria-hidden>
            <rect x="3" y="4" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
        Mode classe
      </button>
    </header>
  );
}
