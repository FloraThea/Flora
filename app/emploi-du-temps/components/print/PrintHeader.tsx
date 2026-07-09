import type { PrintThemeTokens } from "@/lib/timetable/export/print-theme";
import type { SchedulePrintMeta } from "@/lib/timetable/export/types";

type PrintHeaderProps = {
  meta: SchedulePrintMeta;
  theme: PrintThemeTokens;
};

function FloraLogoMark({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3c-4 6-6 9-6 13a6 6 0 0 0 12 0c0-4-2-7-6-13Z"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M12 16v5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color,
        }}
      >
        Flora
      </span>
    </div>
  );
}

export function PrintHeader({ meta, theme }: PrintHeaderProps) {
  return (
    <header
      style={{
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 24,
        marginBottom: 28,
        alignItems: "start",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: theme.mutedText,
            fontWeight: 600,
          }}
        >
          Emploi du temps
        </p>
        <h1
          style={{
            margin: "8px 0 0",
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.08,
            color: theme.headerText,
          }}
        >
          {meta.className}
        </h1>
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "10px 32px",
            fontSize: 15,
            color: theme.mutedText,
            lineHeight: 1.4,
          }}
        >
          <p style={{ margin: 0 }}>
            <strong style={{ color: theme.headerText, fontWeight: 600 }}>Enseignant·e</strong>
            <br />
            {meta.teacherName}
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: theme.headerText, fontWeight: 600 }}>Année scolaire</strong>
            <br />
            {meta.schoolYear}
          </p>
          {meta.period ? (
            <p style={{ margin: 0 }}>
              <strong style={{ color: theme.headerText, fontWeight: 600 }}>Période</strong>
              <br />
              {meta.period}
            </p>
          ) : null}
          <p style={{ margin: 0 }}>
            <strong style={{ color: theme.headerText, fontWeight: 600 }}>Généré le</strong>
            <br />
            {meta.generatedAt}
          </p>
        </div>
      </div>
      <FloraLogoMark color={theme.tableHeaderBg} />
    </header>
  );
}
