/**
 * Limite Vercel Hobby (et Pro par défaut) pour les Serverless Functions.
 * Dans les routes API, exporter `export const maxDuration = 300` (valeur littérale) :
 * Next.js n'accepte pas une constante importée pour la config de segment.
 */
export const VERCEL_MAX_DURATION_SECONDS = 300;
