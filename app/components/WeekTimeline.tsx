const days = [
  {
    name: "Lundi",
    items: ["Français", "Rituels"],
    accent: "rose" as const,
    isToday: false,
  },
  {
    name: "Mardi",
    items: ["Maths", "EPS"],
    accent: "sauge" as const,
    isToday: false,
  },
  {
    name: "Jeudi",
    items: ["Lecture", "Arts plastiques"],
    accent: "lavande" as const,
    isToday: true,
  },
  {
    name: "Vendredi",
    items: ["MHM", "Sortie"],
    accent: "peche" as const,
    isToday: false,
  },
];

const accentStyles = {
  rose: {
    card: "border-rose-soft/50 bg-rose-soft/30",
    badge: "bg-rose-poudre/40 text-[#b88989]",
  },
  sauge: {
    card: "border-sauge-light/50 bg-sauge-light/25",
    badge: "bg-sauge-light/50 text-sauge",
  },
  lavande: {
    card: "border-lavande-light/60 bg-lavande-light/35",
    badge: "bg-lavande-light/60 text-[#9a8ab0]",
  },
  peche: {
    card: "border-peche/40 bg-peche-light/40",
    badge: "bg-peche/30 text-[#c49a88]",
  },
};

export function WeekTimeline() {
  return (
    <section className="mb-8">
      <h3 className="mb-4 font-serif text-2xl font-medium text-flora-text">
        Cette semaine
      </h3>

      <div className="relative">
        <div
          className="absolute top-8 right-8 left-8 hidden h-px bg-gradient-to-r from-rose-soft/60 via-lavande-light/50 to-peche-light/60 lg:block"
          aria-hidden
        />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {days.map((day) => {
            const styles = accentStyles[day.accent];
            return (
              <article
                key={day.name}
                className={`relative rounded-3xl border ${styles.card} p-5 shadow-[0_2px_16px_rgba(0,0,0,0.025)] backdrop-blur-sm ${
                  day.isToday
                    ? "ring-2 ring-rose-poudre/30 ring-offset-2 ring-offset-cream"
                    : ""
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-serif text-lg font-medium text-flora-text">
                    {day.name}
                  </p>
                  {day.isToday && (
                    <span className="rounded-full bg-rose-poudre/35 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-[#b88989] uppercase">
                      Aujourd&apos;hui
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-2">
                  {day.items.map((item, itemIndex) => (
                    <li
                      key={`${day.name}-${item}-${itemIndex}`}
                      className={`rounded-xl px-3 py-2 text-xs font-light ${styles.badge}`}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
