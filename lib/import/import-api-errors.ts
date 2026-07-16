export type ImportApiErrorBody = {
  error?: string;
  details?: string;
  step?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidImportUuid(value: string | undefined | null): boolean {
  return Boolean(value && UUID_PATTERN.test(value));
}

export async function readImportApiResponse<T extends ImportApiErrorBody>(
  response: Response,
  fallback: string,
): Promise<T> {
  const raw = await response.text();

  if (!raw.trim()) {
    throw new Error(
      response.ok
        ? fallback
        : `${fallback} (réponse vide du serveur, HTTP ${response.status}).`,
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    const snippet = raw.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      `${fallback} (HTTP ${response.status}${snippet ? ` — ${snippet}` : ""}).`,
    );
  }
}

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
