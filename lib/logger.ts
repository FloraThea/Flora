/** Logs informatifs — silencieux en production. */
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.info(...args);
  }
}

/** Logs de débogage — silencieux en production. */
export function devDebug(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug(...args);
  }
}

/** Avertissements — conservés en production pour le diagnostic. */
export function logWarn(...args: unknown[]): void {
  console.warn(...args);
}

/** Erreurs — toujours journalisées. */
export function logError(...args: unknown[]): void {
  console.error(...args);
}
