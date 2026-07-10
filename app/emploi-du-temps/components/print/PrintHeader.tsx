import type { PrintThemeTokens } from "@/lib/timetable/export/print-theme";
import { HEADER_TITLE_FONT_PX, PRINT_FONT_FAMILY } from "@/lib/timetable/export/print-theme";
import type { SchedulePrintMeta } from "@/lib/timetable/export/types";

type PrintHeaderProps = {
  meta: SchedulePrintMeta;
  theme: PrintThemeTokens;
};

function MetaRow({ label, value, theme }: { label: string; value: string; theme: PrintThemeTokens }) {
  return (
    <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: theme.headerText }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <br />
      <span style={{ fontWeight: 400 }}>{value}</span>
    </p>
  );
}

export function PrintHeader({ meta, theme }: PrintHeaderProps) {
  const metaRows: { label: string; value: string }[] = [
    { label: "Classe", value: meta.className },
    { label: "Enseignant·e", value: meta.teacherName },
    { label: "Année scolaire", value: meta.schoolYear },
  ];

  if (meta.zone) metaRows.push({ label: "Zone", value: meta.zone });
  if (meta.schoolName) metaRows.push({ label: "École", value: meta.schoolName });
  if (meta.period) metaRows.push({ label: "Période", value: meta.period });

  return (
    <header
      style={{
        position: "relative",
        zIndex: 1,
        marginBottom: 32,
        textAlign: "center",
        fontFamily: PRINT_FONT_FAMILY,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: HEADER_TITLE_FONT_PX,
          fontWeight: 700,
          letterSpacing: "0.06em",
          lineHeight: 1.1,
          color: theme.headerText,
          textTransform: "uppercase",
        }}
      >
        Emploi du temps
      </h1>

      <div
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "14px 48px",
          textAlign: "left",
          maxWidth: 720,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {metaRows.map((row) => (
          <MetaRow key={row.label} label={row.label} value={row.value} theme={theme} />
        ))}
      </div>
    </header>
  );
}
