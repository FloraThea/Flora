const stats = [
  {
    id: "seances",
    value: "5",
    label: "séances prévues",
    accent: "rose" as const,
  },
  {
    id: "rituels",
    value: "2",
    label: "rituels",
    accent: "sauge" as const,
  },
  {
    id: "evenement",
    value: "1",
    label: "événement",
    accent: "lavande" as const,
  },
  {
    id: "ressources",
    value: "3",
    label: "ressources à préparer",
    accent: "peche" as const,
  },
];

const accentStyles = {
  rose: {
    bg: "bg-rose-soft/50",
    dot: "bg-rose-poudre",
    text: "text-[#b88989]",
  },
  sauge: {
    bg: "bg-sauge-light/35",
    dot: "bg-sauge",
    text: "text-sauge",
  },
  lavande: {
    bg: "bg-lavande-light/50",
    dot: "bg-lavande",
    text: "text-[#9a8ab0]",
  },
  peche: {
    bg: "bg-peche-light/60",
    dot: "bg-peche",
    text: "text-[#c49a88]",
  },
};

export function TodayBlock() {
  return (
    <section className="mb-8">
      <h3 className="mb-4 font-serif text-2xl font-medium text-flora-text">
        Aujourd&apos;hui
      </h3>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const styles = accentStyles[stat.accent];
          return (
            <article
              key={stat.id}
              className={`rounded-3xl border border-white/70 ${styles.bg} p-5 shadow-[0_2px_16px_rgba(0,0,0,0.025)] backdrop-blur-sm`}
            >
              <p className={`font-serif text-3xl font-medium ${styles.text}`}>
                {stat.value}
              </p>
              <p className="mt-1.5 text-sm font-light leading-snug text-flora-text-subtle">
                {stat.label}
              </p>
              <span
                className={`mt-4 inline-block h-1 w-6 rounded-full ${styles.dot} opacity-50`}
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
