export {
  detectDocumentStructure,
  parseDocumentStructure,
  shouldRestituteFromStructure,
} from "./detect-structure";
export {
  resolveProgressionStructure,
  resolveProgressionStructureSync,
  structureToMetadata,
} from "./resolve-structure-sync";
export {
  loadDocumentStructureById,
  resolveProgressionStructureWithDocument,
} from "./resolve-structure";
export {
  LIBRE_STRUCTURE as DEFAULT_LIBRE_STRUCTURE,
  MHM_MATH_STRUCTURE,
  type DocumentStructure,
  type DocumentStructureKind,
  type SequenceGroupingLevel,
} from "./types";
export { LIBRE_STRUCTURE } from "./types";
