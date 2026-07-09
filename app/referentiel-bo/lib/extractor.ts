import type {
  AnalysisStep,
  AnalysisStepId,
  AnalyzeDocumentResult,
  BoReference,
} from "../types";

export const initialAnalysisSteps: AnalysisStep[] = [
  { id: "reading", label: "Lecture du document", status: "pending" },
  { id: "structure", label: "Repérage de la structure", status: "pending" },
  { id: "subjects", label: "Détection des matières", status: "pending" },
  { id: "competencies", label: "Extraction des compétences", status: "pending" },
  { id: "generation", label: "Génération du référentiel", status: "pending" },
];

export function resetAnalysisSteps(): AnalysisStep[] {
  return initialAnalysisSteps.map((step) => ({ ...step, status: "pending" }));
}

export function setAnalysisStepStatus(
  steps: AnalysisStep[],
  stepId: AnalysisStepId,
  status: AnalysisStep["status"],
): AnalysisStep[] {
  return steps.map((step) =>
    step.id === stepId ? { ...step, status } : step,
  );
}
