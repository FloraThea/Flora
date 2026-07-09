const preparations = [
  {
    id: "lecture-comprehension",
    title: "Lecture compréhension",
    progress: 72,
    accent: "rose" as const,
  },
  {
    id: "mhm-ce1",
    title: "MHM CE1",
    progress: 45,
    accent: "sauge" as const,
  },
  {
    id: "arts-plastiques",
    title: "Arts plastiques",
    progress: 88,
    accent: "lavande" as const,
  },
];

const accentStyles = {
  rose: {
    card: "border-rose-soft/60 bg-rose-soft/25",
    bar: "bg-rose-poudre",
    label: "text-[#b88989]",
  },
  sauge: {
    card: "border-sauge-light/50 bg-sauge-light/20",
    bar: "bg-sauge",
    label: "text-sauge",
  },
  lavande: {
    card: "border-lavande-light/60 bg-lavande-light/30",
    bar: "bg-lavande",
    label: "text-[#9a8ab0]",
  },
};

export function PreparationCards() {
  return (
    <section className="mb-8">
      <h3 className="mb-4 font-serif text-2xl font-medium text-flora-text">
        Continuer mes préparations
      </h3>
      <div className="grid gap-4 lg:grid-cols-3">
        {preparations.map((item) => {
          const styles = accentStyles[item.accent];
          return (
            <article
              key={item.id}
              className={`group cursor-pointer rounded-3xl border ${styles.card} p-6 shadow-[0_2px_16px_rgba(0,0,0,0.025)] backdrop-blur-sm transition-all duration-300 hover:shadow-[0_6px_24px_rgba(0,0,0,0.04)]`}
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-serif text-xl font-medium text-flora-text">
                  {item.title}
                </h4>
                <span className={`text-sm font-light ${styles.label}`}>
                  {item.progress}%
                </span>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/60">
                <div
                  className={`h-full rounded-full ${styles.bar} opacity-70 transition-all duration-500`}
                  style={{ width: `${item.progress}%` }}
                />
              </div>

              <p className="mt-4 text-xs font-light text-flora-text-subtle">
                Cliquer pour reprendre
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
