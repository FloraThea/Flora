import type { UnifiedImportBatchConfig, UnifiedImportEngine } from "./unified-import-engine";
import { documentImportEngine } from "./engines/document-engine";
import { programmationImportEngine } from "./engines/programmation-engine";
import { progressionImportEngine } from "./engines/progression-engine";
import { timetableImportEngine } from "./engines/timetable-engine";

export { documentImportEngine } from "./engines/document-engine";
export { programmationImportEngine } from "./engines/programmation-engine";
export { progressionImportEngine } from "./engines/progression-engine";
export { timetableImportEngine } from "./engines/timetable-engine";

export function getUnifiedImportEngine(
  module: UnifiedImportBatchConfig["module"],
): UnifiedImportEngine<unknown, unknown, unknown> {
  switch (module) {
    case "programmation":
      return programmationImportEngine as UnifiedImportEngine<unknown, unknown, unknown>;
    case "progression":
      return progressionImportEngine as UnifiedImportEngine<unknown, unknown, unknown>;
    case "timetable":
      return timetableImportEngine as UnifiedImportEngine<unknown, unknown, unknown>;
    case "document":
      return documentImportEngine as UnifiedImportEngine<unknown, unknown, unknown>;
    default: {
      const exhaustive: never = module;
      throw new Error(`Module d'import inconnu : ${exhaustive}`);
    }
  }
}
