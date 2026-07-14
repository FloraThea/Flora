export type ImportApiErrorBody = {
  error?: string;
  details?: string;
  step?: string;
};

export function parseImportApiError(data: ImportApiErrorBody, fallback: string): string {
  const details = data.details?.trim();
  const error = data.error?.trim();
  if (error && details && error !== details) {
    return `${error} — ${details}`;
  }
  return error || details || fallback;
}

export function mapImportFailureMessage(step: string, rawMessage: string): string {
  const message = rawMessage.trim();
  if (message) return message;

  if (step.startsWith("upload")) {
    return "Le téléversement des fichiers a échoué.";
  }
  if (step === "batch_create") {
    return "Impossible de créer le lot d'import.";
  }
  if (step === "analyze") {
    return "L'analyse des pages a échoué.";
  }
  if (step === "merge") {
    return "Les données ont été analysées, mais la fusion a échoué.";
  }
  if (step === "save") {
    return "L'enregistrement a échoué.";
  }

  return "Une erreur inattendue est survenue pendant l'import.";
}
