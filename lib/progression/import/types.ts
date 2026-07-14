import type {
  ImportedProgrammationRow,
  ParsedProgrammationImport,
  ProgrammationColumnField,
  ProgrammationImportFormat,
} from "@/lib/programming/import/types";
import type { ProgressionTab } from "../types";

export type ProgressionImportFormat = ProgrammationImportFormat | "image";

export type ParsedProgressionImport = Omit<ParsedProgrammationImport, "format"> & {
  format: ProgressionImportFormat;
};

export type ProgressionImportSession = {
  parsed: ParsedProgressionImport;
  tabs: ProgressionTab[];
  programmationId: string | null;
  methode: string;
  title: string;
  competencyMatches: Record<string, unknown>;
};

export type { ImportedProgrammationRow, ProgrammationColumnField };
