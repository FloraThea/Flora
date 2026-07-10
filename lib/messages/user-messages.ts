/** Messages utilisateur standardisés — clairs, non techniques. */
export const floraMessages = {
  saveSuccess: "Enregistrement réussi.",
  saveError: "Impossible d'enregistrer vos modifications. Réessayez dans un instant.",
  importSuccess: "Import terminé.",
  importError: "Erreur d'import. Vérifiez le format du fichier et réessayez.",
  analyzeSuccess: "Analyse terminée.",
  analyzeError: "L'analyse a échoué. Réessayez ou choisissez un autre fichier.",
  supabaseError: "Erreur de connexion à la base de données. Réessayez plus tard.",
  networkError: "Connexion impossible. Vérifiez votre réseau et réessayez.",
  loadError: "Impossible de charger les données.",
} as const;

export function toUserErrorMessage(error: unknown, fallback = floraMessages.saveError): string {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message.trim();
  if (!msg) return fallback;
  if (/supabase|postgres|pgrst|row level security/i.test(msg)) return floraMessages.supabaseError;
  if (/fetch|network|failed to fetch/i.test(msg)) return floraMessages.networkError;
  if (/import|parse|xlsx|csv|pdf|docx/i.test(msg)) return floraMessages.importError;
  return msg.length > 120 ? fallback : msg;
}
